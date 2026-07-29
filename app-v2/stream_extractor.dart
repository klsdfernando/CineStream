import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:http/http.dart' as http;

// ---------------------------------------------------------------------------
// Data models returned by the extractor
// ---------------------------------------------------------------------------

class StreamTrack {
  final String url;
  final String label; // e.g. "1080p", "720p", "Auto"
  final int? bandwidth; // bits per second
  final int? width;
  final int? height;

  const StreamTrack({
    required this.url,
    required this.label,
    this.bandwidth,
    this.width,
    this.height,
  });

  Map<String, dynamic> toJson() => {
        'url': url,
        'label': label,
        if (bandwidth != null) 'bandwidth': bandwidth,
        if (width != null) 'width': width,
        if (height != null) 'height': height,
      };

  factory StreamTrack.fromJson(Map<String, dynamic> json) => StreamTrack(
        url: json['url'] as String,
        label: json['label'] as String,
        bandwidth: json['bandwidth'] as int?,
        width: json['width'] as int?,
        height: json['height'] as int?,
      );

  @override
  String toString() => 'StreamTrack($label, $url)';
}

class SubtitleTrack {
  final String url;
  final String label; // e.g. "English", "Spanish"
  final String language; // BCP-47 code, e.g. "en", "es"

  const SubtitleTrack({
    required this.url,
    required this.label,
    required this.language,
  });

  Map<String, dynamic> toJson() => {
        'url': url,
        'label': label,
        'language': language,
      };

  factory SubtitleTrack.fromJson(Map<String, dynamic> json) => SubtitleTrack(
        url: json['url'] as String,
        label: json['label'] as String,
        language: json['language'] as String,
      );

  @override
  String toString() => 'SubtitleTrack($label, $url)';
}

class StreamInfo {
  /// All playable video tracks, sorted highest quality first.
  final List<StreamTrack> videoTracks;

  /// All subtitle/caption tracks (may be empty).
  final List<SubtitleTrack> subtitleTracks;

  const StreamInfo({
    required this.videoTracks,
    required this.subtitleTracks,
  });

  /// Convenience: the best available stream URL.
  String get bestUrl => videoTracks.first.url;

  bool get hasMultipleQualities => videoTracks.length > 1;
  bool get hasSubtitles => subtitleTracks.isNotEmpty;

  Map<String, dynamic> toJson() => {
        'videoTracks': videoTracks.map((t) => t.toJson()).toList(),
        'subtitleTracks': subtitleTracks.map((s) => s.toJson()).toList(),
      };

  factory StreamInfo.fromJson(Map<String, dynamic> json) => StreamInfo(
        videoTracks: (json['videoTracks'] as List)
            .map((e) => StreamTrack.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        subtitleTracks: (json['subtitleTracks'] as List)
            .map((e) => SubtitleTrack.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );

  @override
  String toString() =>
      'StreamInfo(videos=${videoTracks.length}, subs=${subtitleTracks.length})';
}

/// Optional diagnostics filled in by [StreamExtractor.extractStreamInfo].
///
/// Lets callers distinguish "the page gave us nothing at all" (no point
/// retrying — likely a load failure or hard block) from "we saw candidate
/// URLs but couldn't assemble tracks" (a retry may succeed).
class ExtractionOutcome {
  /// True once any video, subtitle, or embed-page candidate was captured.
  bool capturedAnything = false;
}

class ExtractionPolicy {
  final String name;
  final Set<String> trustedMediaHostHints;  final Set<String> blockedHostHints;
  final Set<String> embedHostHints;
  final Duration defaultTimeout;
  final Duration nestedTimeout;
  final Duration resolveDelayAfterPageLoad;
  final bool allowVideoPathFallback;
  final bool allowSubtitlePathFallback;
  final bool allowEmbedPathFallback;

  const ExtractionPolicy({
    required this.name,
    required this.trustedMediaHostHints,
    required this.blockedHostHints,
    required this.embedHostHints,
    required this.defaultTimeout,
    required this.nestedTimeout,
    required this.resolveDelayAfterPageLoad,
    required this.allowVideoPathFallback,
    required this.allowSubtitlePathFallback,
    required this.allowEmbedPathFallback,
  });

  factory ExtractionPolicy.fromJson(Map<String, dynamic> json) {
    return ExtractionPolicy(
      name: json['name']?.toString().trim().isNotEmpty == true
          ? json['name'].toString().trim()
          : 'server',
      trustedMediaHostHints: _readStringSet(json['trustedMediaHostHints']),
      blockedHostHints: _readStringSet(json['blockedHostHints']),
      embedHostHints: _readStringSet(json['embedHostHints']),
      defaultTimeout: Duration(
        seconds: _readInt(json['defaultTimeoutSeconds'], 20),
      ),
      nestedTimeout: Duration(
        seconds: _readInt(json['nestedTimeoutSeconds'], 12),
      ),
      resolveDelayAfterPageLoad: Duration(
        seconds: _readInt(json['resolveDelayAfterPageLoadSeconds'], 11),
      ),
      allowVideoPathFallback:
          _readBool(json['allowVideoPathFallback'], defaultValue: true),
      allowSubtitlePathFallback:
          _readBool(json['allowSubtitlePathFallback'], defaultValue: true),
      allowEmbedPathFallback:
          _readBool(json['allowEmbedPathFallback'], defaultValue: true),
    );
  }
}

Set<String> _readStringSet(Object? value) {
  if (value is List) {
    return value
        .map((item) => item.toString().trim().toLowerCase())
        .where((item) => item.isNotEmpty)
        .toSet();
  }
  return const {};
}

int _readInt(Object? value, int fallback) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

bool _readBool(Object? value, {required bool defaultValue}) {
  if (value is bool) return value;
  final normalized = value?.toString().trim().toLowerCase();
  if (normalized == 'true' || normalized == '1' || normalized == 'yes') {
    return true;
  }
  if (normalized == 'false' || normalized == '0' || normalized == 'no') {
    return false;
  }
  return defaultValue;
}

// ---------------------------------------------------------------------------
// StreamExtractor
// ---------------------------------------------------------------------------

class _ExtractionProfile {
  final String name;
  final Set<String> trustedMediaHostHints;
  final Set<String> blockedHostHints;
  final Set<String> embedHostHints;
  final Duration defaultTimeout;
  final Duration nestedTimeout;
  final Duration resolveDelayAfterPageLoad;
  final bool allowVideoPathFallback;
  final bool allowSubtitlePathFallback;
  final bool allowEmbedPathFallback;

  const _ExtractionProfile({
    required this.name,
    required this.trustedMediaHostHints,
    required this.blockedHostHints,
    required this.embedHostHints,
    required this.defaultTimeout,
    required this.nestedTimeout,
    required this.resolveDelayAfterPageLoad,
    required this.allowVideoPathFallback,
    required this.allowSubtitlePathFallback,
    required this.allowEmbedPathFallback,
  });
}

class StreamExtractor {
  static const String _desktopUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  static const int _maxPreviewCandidates = 4;
  static const int _maxJsMessageChars = 16 * 1024;
  static const int _maxCandidatesPerMessage = 32;
  static const int _maxCapturedVideoUrls = 180;
  static const int _maxCapturedSubtitleUrls = 120;
  static const int _maxCapturedPageUrls = 80;
  static const int _maxDecodedTraversalNodes = 640;
  static const int _maxDecodedStringChars = 4096;
  static const int _maxCapturedUrlChars = 2048;
  static const int _maxNestedExtractionDepth = 1;
  static const int _maxNestedPageCandidates = 3;

  static const Set<String> _commonTrustedMediaHostHints = {
    'stream',
    'video',
    'cdn',
    'cloudfront',
    'akamai',
    'fastly',
    'bunnycdn',
    'googlevideo',
    'jwplayer',
    'm3u8',
    'playlist',
  };

  static const Set<String> _commonBlockedHostHints = {
    'doubleclick',
    'googlesyndication',
    'google-analytics',
    'googletagmanager',
    'adservice',
    'taboola',
    'outbrain',
    'scorecardresearch',
    'hotjar',
    'appsflyer',
    'branch.io',
    'unpkg.com',
    'histats',
    'adsterra',
    'popads',
    'propellerads',
    'onclick',
    'jiggleroctene',
    'disable-devtool',
  };

  static final _ExtractionProfile _autoProfile = _ExtractionProfile(
    name: 'auto',
    trustedMediaHostHints: {
      ..._commonTrustedMediaHostHints,
      'mcloud',
      'vidcloud',
      'rabbitstream',
    },
    blockedHostHints: {..._commonBlockedHostHints},
    embedHostHints: const {},
    defaultTimeout: const Duration(seconds: 20),
    nestedTimeout: const Duration(seconds: 12),
    resolveDelayAfterPageLoad: const Duration(seconds: 11),
    allowVideoPathFallback: true,
    allowSubtitlePathFallback: true,
    allowEmbedPathFallback: true,
  );

  /// Sniff the page at [pageUrl] and return a [StreamInfo] with all available
  /// video tracks and subtitle tracks, or `null` on timeout / failure.
  static Future<StreamInfo?> extractStreamInfo(
    String pageUrl, {
    ExtractionPolicy? policy,
    Duration? timeout,
    Future<void>? cancelSignal,
    ExtractionOutcome? outcome,
  }) {
    final profile = _profileFromPolicy(policy);
    return _extractStreamInfoWithProfile(
      pageUrl,
      profile: profile,
      timeout: timeout,
      cancelSignal: cancelSignal,
      outcome: outcome,
    );
  }

  static _ExtractionProfile _profileFromPolicy(ExtractionPolicy? policy) {
    if (policy == null) return _autoProfile;
    return _ExtractionProfile(
      name: policy.name,
      trustedMediaHostHints: policy.trustedMediaHostHints.isEmpty
          ? _autoProfile.trustedMediaHostHints
          : policy.trustedMediaHostHints,
      blockedHostHints: policy.blockedHostHints.isEmpty
          ? _autoProfile.blockedHostHints
          : policy.blockedHostHints,
      embedHostHints: policy.embedHostHints,
      defaultTimeout: policy.defaultTimeout,
      nestedTimeout: policy.nestedTimeout,
      resolveDelayAfterPageLoad: policy.resolveDelayAfterPageLoad,
      allowVideoPathFallback: policy.allowVideoPathFallback,
      allowSubtitlePathFallback: policy.allowSubtitlePathFallback,
      allowEmbedPathFallback: policy.allowEmbedPathFallback,
    );
  }

  static Future<StreamInfo?> _extractStreamInfoWithProfile(
    String pageUrl, {
    required _ExtractionProfile profile,
    Duration? timeout,
    Future<void>? cancelSignal,
    int depth = 0,
    Set<String>? visitedPages,
    ExtractionOutcome? outcome,
  }) async {
    final effectiveTimeout = timeout ?? profile.defaultTimeout;
    final traversalVisited = visitedPages ?? <String>{};
    final traversalKey = _normalizeTraversalPageKey(pageUrl);
    if (traversalKey.isEmpty || traversalVisited.contains(traversalKey)) {
      if (traversalKey.isNotEmpty) {
        debugPrint('[StreamExtractor/${profile.name}] Skip visited: $pageUrl');
      }
      return null;
    }
    traversalVisited.add(traversalKey);

    final completer = Completer<StreamInfo?>();

    // Collect every intercepted URL before deciding
    final Set<String> capturedUrls = {};
    final Set<String> capturedSubUrls = {};
    final Set<String> capturedPageUrls = {};

    // Timer that fires after [timeout] and resolves with whatever we have
    Timer? resolveTimer;

    // Track whether we've scheduled resolution
    bool resolving = false;
    bool cancelled = false;
    bool cleanupStarted = false;
    // Wall-clock ceiling set by a high-confidence hit: once armed, later
    // low-confidence URLs may still debounce, but never past this deadline.
    DateTime? resolveCeiling;
    HeadlessInAppWebView? headlessWebView;
    InAppWebViewController? controller;

    Future<void> cleanupController() async {
      if (cleanupStarted) return;
      cleanupStarted = true;
      try {
        await controller
            ?.stopLoading()
            .timeout(const Duration(milliseconds: 500), onTimeout: () {});
      } catch (_) {}
      try {
        await headlessWebView?.dispose();
      } catch (_) {}
    }

    Future<void> tryResolve() async {
      if (resolving || completer.isCompleted || cancelled) return;
      resolving = true;
      resolveTimer?.cancel();

      debugPrint(
        '[StreamExtractor/${profile.name}] Resolving candidates: '
        'videos=${capturedUrls.length}, '
        'subtitles=${capturedSubUrls.length}, '
        'embedPages=${capturedPageUrls.length}',
      );

      if (capturedUrls.isEmpty) {
        if (depth < _maxNestedExtractionDepth && capturedPageUrls.isNotEmpty) {
          final nestedCandidates = _rankEmbedPageCandidates(
            capturedPageUrls,
            currentPageUrl: pageUrl,
            visitedPages: traversalVisited,
            profile: profile,
          );

          if (nestedCandidates.isNotEmpty) {
            debugPrint(
              '[StreamExtractor/${profile.name}] Trying nested embed pages: '
              '${_previewList(nestedCandidates)}',
            );
          }

          for (final nestedUrl in nestedCandidates) {
            final nestedInfo = await _extractStreamInfoWithProfile(
              nestedUrl,
              profile: profile,
              timeout: profile.nestedTimeout,
              cancelSignal: cancelSignal,
              depth: depth + 1,
              visitedPages: traversalVisited,
            );

            if (nestedInfo != null && nestedInfo.videoTracks.isNotEmpty) {
              debugPrint(
                '[StreamExtractor/${profile.name}] '
                'Resolved via nested page: $nestedUrl',
              );
              if (!completer.isCompleted) {
                completer.complete(nestedInfo);
              }
              return;
            }
          }
        }

        debugPrint(
          '[StreamExtractor/${profile.name}] No streams captured – returning null',
        );
        completer.complete(null);
        return;
      }

      final playlistCandidates = _rankPlaylistCandidates(
        capturedUrls,
        profile: profile,
      );
      if (playlistCandidates.isNotEmpty) {
        debugPrint(
          '[StreamExtractor/${profile.name}] Ranked playlist candidates: '
          '${_previewList(playlistCandidates)}',
        );
      }

      StreamInfo? info;
      for (final playlistUrl in playlistCandidates) {
        final parsed = await _parseMasterPlaylist(
          playlistUrl,
          capturedSubUrls,
          requestContextUrl: pageUrl,
        );
        if (parsed != null && parsed.videoTracks.isNotEmpty) {
          info = parsed;
          debugPrint(
            '[StreamExtractor/${profile.name}] '
            'Selected playlist candidate: $playlistUrl',
          );
          break;
        }
      }

      info ??= _buildFallbackInfo(
        capturedUrls,
        capturedSubUrls,
        profile: profile,
      );

      if (info.videoTracks.isEmpty) {
        debugPrint(
          '[StreamExtractor/${profile.name}] No playable tracks after resolution',
        );
        if (!completer.isCompleted) completer.complete(null);
        return;
      }

      debugPrint('[StreamExtractor/${profile.name}] Resolved: $info');
      if (!completer.isCompleted) completer.complete(info);
    }

    // Arms the resolve timer. Normal calls debounce (cancel + re-arm) so the
    // page can keep emitting better variant URLs. [ceiling] marks a
    // high-confidence hit: it caps how far the debounce can be pushed out, so
    // later low-confidence URLs can't delay a resolve we're already confident
    // about. The effective delay is clamped to the tightest active ceiling.
    void scheduleResolve(Duration delay, {bool ceiling = false}) {
      if (cancelled || completer.isCompleted) return;
      final now = DateTime.now();
      var deadline = now.add(delay);
      if (ceiling) {
        if (resolveCeiling == null || deadline.isBefore(resolveCeiling!)) {
          resolveCeiling = deadline;
        }
      }
      if (resolveCeiling != null && deadline.isAfter(resolveCeiling!)) {
        deadline = resolveCeiling!;
      }
      final effective = deadline.difference(now);
      resolveTimer?.cancel();
      resolveTimer = Timer(
        effective.isNegative ? Duration.zero : effective,
        tryResolve,
      );
    }

    // Process a single already-extracted URL candidate against the capture
    // policy. Shared by the in-page JS channel and the native request
    // interceptor (which also sees cross-origin iframe sub-resources).
    void handleCandidate(String rawCandidate) {
      final candidate = _normalizeCapturedUrl(rawCandidate);
      if (candidate.isEmpty) return;

      final lower = candidate.toLowerCase();
      final isVideo = _isLikelyVideoUrl(candidate, profile: profile);
      final isSub = _isLikelySubtitleUrl(candidate, profile: profile);
      final isEmbedPage = _isLikelyEmbedPageUrl(
        candidate,
        contextPageUrl: pageUrl,
        profile: profile,
      );

      if (isVideo &&
          capturedUrls.length < _maxCapturedVideoUrls &&
          capturedUrls.add(candidate)) {
        outcome?.capturedAnything = true;
        debugPrint('[StreamExtractor/${profile.name}] VIDEO: $candidate');
        if (_isHighConfidencePlaylist(candidate, profile: profile)) {
          scheduleResolve(
            const Duration(milliseconds: 600),
            ceiling: true,
          );
        } else {
          scheduleResolve(
            lower.contains('.m3u8')
                ? const Duration(seconds: 3)
                : const Duration(seconds: 5),
          );
        }
      }

      if (isSub &&
          capturedSubUrls.length < _maxCapturedSubtitleUrls &&
          capturedSubUrls.add(candidate)) {
        outcome?.capturedAnything = true;
        debugPrint('[StreamExtractor/${profile.name}] SUBTITLE: $candidate');
      }

      if (isEmbedPage &&
          capturedPageUrls.length < _maxCapturedPageUrls &&
          capturedPageUrls.add(candidate)) {
        outcome?.capturedAnything = true;
        debugPrint('[StreamExtractor/${profile.name}] EMBED_PAGE: $candidate');
      }

      if (capturedUrls.length >= _maxCapturedVideoUrls ||
          capturedSubUrls.length >= _maxCapturedSubtitleUrls ||
          capturedPageUrls.length >= _maxCapturedPageUrls) {
        scheduleResolve(const Duration(milliseconds: 400));
      }
    }

    void handleRawMessage(String rawMessage) {
      if (completer.isCompleted || cancelled) return;
      if (rawMessage.length > _maxJsMessageChars) {
        debugPrint(
          '[StreamExtractor] Ignored oversized channel payload '
          '(${rawMessage.length} chars)',
        );
        return;
      }

      final rawCandidates =
          _extractUrlsFromMessage(rawMessage).take(_maxCandidatesPerMessage);
      for (final rawCandidate in rawCandidates) {
        handleCandidate(rawCandidate);
      }
    }

    headlessWebView = HeadlessInAppWebView(
      initialUrlRequest: URLRequest(
        url: WebUri(pageUrl),
        headers: const {
          'Referer': 'https://www.google.com/',
          'Accept':
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      ),
      initialSettings: InAppWebViewSettings(
        javaScriptEnabled: true,
        javaScriptCanOpenWindowsAutomatically: false,
        mediaPlaybackRequiresUserGesture: false,
        supportMultipleWindows: false,
        transparentBackground: true,
        useShouldInterceptRequest: Platform.isAndroid,
        thirdPartyCookiesEnabled: false,
        cacheEnabled: false,
        userAgent: _desktopUserAgent,
      ),
      onWebViewCreated: (webViewController) {
        controller = webViewController;
        webViewController.addJavaScriptHandler(
          handlerName: 'ExtractorChannel',
          callback: (args) {
            if (args.isNotEmpty) {
              handleRawMessage(args.first.toString());
            }
            return null;
          },
        );
      },
      onLoadStop: (webViewController, _) async {
        try {
          await webViewController.evaluateJavascript(
            source: _buildInjectionScript(),
          );
        } catch (_) {}
        scheduleResolve(profile.resolveDelayAfterPageLoad);
      },
      // Native interception sees ALL requests, including those made from
      // cross-origin iframes where embed providers (e.g. VidLink) actually
      // load the .m3u8 — the in-page JS hooks are same-origin-only and miss
      // them entirely.
      shouldInterceptRequest: Platform.isAndroid
          ? (webViewController, request) async {
              final url = request.url.toString();
              if (url.isNotEmpty) {
                handleCandidate(url);
              }
              return null;
            }
          : null,
    );

    debugPrint('[StreamExtractor/${profile.name}] Sniffing: $pageUrl');
    await headlessWebView.run();

    if (cancelSignal != null) {
      unawaited(
        cancelSignal.then((_) async {
          cancelled = true;
          resolveTimer?.cancel();
          if (!completer.isCompleted) {
            completer.complete(null);
          }
          await cleanupController();
        }),
      );
    }

    completer.future.whenComplete(() {
      unawaited(cleanupController());
    });

    // Hard timeout
    return completer.future.timeout(
      effectiveTimeout,
      onTimeout: () async {
        if (cancelled) return null;
        if (!completer.isCompleted) {
          debugPrint('[StreamExtractor/${profile.name}] Hard timeout');
          await tryResolve();
        }
        if (!completer.isCompleted) {
          completer.complete(null);
        }
        return completer.future;
      },
    );
  }

  static Iterable<String> _extractUrlsFromMessage(String message) sync* {
    final trimmed = message.trim();
    if (trimmed.isEmpty || trimmed.length > _maxJsMessageChars) {
      return;
    }

    final scopedText = trimmed.length > _maxDecodedStringChars
        ? trimmed.substring(0, _maxDecodedStringChars)
        : trimmed;

    if (scopedText.startsWith('http://') || scopedText.startsWith('https://')) {
      yield scopedText;
    }

    final rawUrlRegex = RegExp(
      r'''https?:\/\/[^\s"'<>\\]+''',
      caseSensitive: false,
    );
    for (final match in rawUrlRegex.allMatches(scopedText)) {
      final value = match.group(0);
      if (value != null) yield value;
    }

    final escapedUrlRegex = RegExp(
      r'''https?:\\\/\\\/[^"'\s<>\\]+''',
      caseSensitive: false,
    );
    for (final match in escapedUrlRegex.allMatches(scopedText)) {
      final value = match.group(0);
      if (value != null) yield value.replaceAll(r'\/', '/');
    }

    try {
      final decoded = jsonDecode(scopedText);
      yield* _collectUrlsFromDecodedValue(decoded);
    } catch (_) {
      // Ignore non-JSON payloads.
    }
  }

  static Iterable<String> _collectUrlsFromDecodedValue(Object? value) sync* {
    if (value == null) {
      return;
    }

    final queue = Queue<Object?>()..add(value);
    var visited = 0;

    while (queue.isNotEmpty && visited < _maxDecodedTraversalNodes) {
      final current = queue.removeFirst();
      visited += 1;

      if (current == null) {
        continue;
      }

      if (current is String) {
        final trimmed = current.trim();
        if (trimmed.isEmpty || trimmed.length > _maxDecodedStringChars) {
          continue;
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          yield trimmed;
        }

        final regex = RegExp(
          r'''https?:\/\/[^\s"'<>\\]+''',
          caseSensitive: false,
        );
        for (final match in regex.allMatches(trimmed)) {
          final extracted = match.group(0);
          if (extracted != null) {
            yield extracted;
          }
        }
        continue;
      }

      if (current is List) {
        for (final item in current.take(80)) {
          queue.add(item);
        }
        continue;
      }

      if (current is Map) {
        for (final item in current.values.take(80)) {
          queue.add(item);
        }
      }
    }
  }

  static String _normalizeCapturedUrl(String raw) {
    var normalized = raw.trim();
    if (normalized.isEmpty) return '';

    if ((normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))) {
      normalized = normalized.substring(1, normalized.length - 1).trim();
    }

    normalized = normalized
        .replaceAll(r'\/', '/')
        .replaceAll(r'\u0026', '&')
        .replaceAll(r'\u003d', '=')
        .replaceAll(r'\u002F', '/')
        .replaceAll(r'\u002f', '/')
        .replaceAll('&amp;', '&')
        .replaceAll(RegExp(r'[\x00-\x1F\x7F]'), '');

    if (normalized.contains('%25')) {
      try {
        normalized = Uri.decodeFull(normalized);
      } catch (_) {
        // Keep original when decode fails.
      }
    }

    if (normalized.length > _maxCapturedUrlChars) {
      return '';
    }

    return normalized;
  }

  static bool _isLikelyVideoUrl(
    String url, {
    required _ExtractionProfile profile,
  }) {
    final lower = url.toLowerCase();
    final hasPlayableExt = lower.contains('.m3u8') ||
        lower.contains('.mp4') ||
        lower.contains('.m4v') ||
        lower.contains('.webm');
    if (!hasPlayableExt) return false;

    if (_isLikelySubtitleUrl(url, profile: profile)) return false;
    return _passesCapturedUrlPolicy(
      url,
      isSubtitle: false,
      profile: profile,
    );
  }

  static bool _isLikelySubtitleUrl(
    String url, {
    required _ExtractionProfile profile,
  }) {
    final lower = url.toLowerCase();
    final hasSubtitleHint = lower.contains('.vtt') ||
        lower.contains('.srt') ||
        lower.contains('.ass') ||
        lower.contains('.ssa') ||
        lower.contains('subtitle') ||
        lower.contains('caption') ||
        lower.contains('/sub/') ||
        lower.contains('/cc/');
    if (!hasSubtitleHint) return false;

    return _passesCapturedUrlPolicy(
      url,
      isSubtitle: true,
      profile: profile,
    );
  }

  static bool _passesCapturedUrlPolicy(
    String url, {
    required bool isSubtitle,
    required _ExtractionProfile profile,
  }) {
    final uri = Uri.tryParse(url);
    if (uri == null || uri.host.isEmpty) {
      return false;
    }

    final scheme = uri.scheme.toLowerCase();
    if (scheme != 'http' && scheme != 'https') {
      return false;
    }

    final hostLower = uri.host.toLowerCase();
    if (_isLocalOrReservedHost(hostLower)) {
      return false;
    }

    if (_isBlockedHost(hostLower, profile: profile)) {
      return false;
    }

    final lower = url.toLowerCase();
    if (_containsIgnoredAssetHint(lower)) {
      return false;
    }

    final isTrustedHost =
        _hasHostHint(hostLower, profile.trustedMediaHostHints);

    if (_looksLikeAdRedirectUrl(
      lower,
      hostLower,
      isTrustedHost: isTrustedHost,
    )) {
      return false;
    }

    if (isSubtitle) {
      return isTrustedHost ||
          (profile.allowSubtitlePathFallback &&
              _containsSubtitlePathHint(lower));
    }

    return isTrustedHost ||
        (profile.allowVideoPathFallback && _containsVideoPathHint(lower));
  }

  static bool _isLocalOrReservedHost(String hostLower) {
    if (hostLower == 'localhost' || hostLower.endsWith('.localhost')) {
      return true;
    }

    final ip = InternetAddress.tryParse(hostLower);
    if (ip == null) {
      return false;
    }

    if (ip.isLoopback || ip.isLinkLocal || ip.isMulticast) {
      return true;
    }

    final raw = ip.rawAddress;
    if (ip.type == InternetAddressType.IPv4 && raw.length == 4) {
      final first = raw[0];
      final second = raw[1];

      // RFC1918 private ranges + localhost + link-local + unspecified/reserved.
      if (first == 10 ||
          first == 127 ||
          first == 0 ||
          (first == 169 && second == 254) ||
          (first == 172 && second >= 16 && second <= 31) ||
          (first == 192 && second == 168) ||
          first >= 224) {
        return true;
      }
    }

    if (ip.type == InternetAddressType.IPv6 && raw.length == 16) {
      final first = raw[0];
      final second = raw[1];

      // fc00::/7 unique local addresses.
      if ((first & 0xFE) == 0xFC) {
        return true;
      }

      // fe80::/10 link-local addresses.
      if (first == 0xFE && (second & 0xC0) == 0x80) {
        return true;
      }

      final isUnspecified = raw.every((byte) => byte == 0);
      if (isUnspecified) {
        return true;
      }
    }

    return false;
  }

  static bool _isBlockedHost(
    String hostLower, {
    required _ExtractionProfile profile,
  }) {
    for (final hint in profile.blockedHostHints) {
      if (hostLower == hint ||
          hostLower.endsWith('.$hint') ||
          hostLower.contains(hint)) {
        return true;
      }
    }
    return false;
  }

  static bool _hasHostHint(String hostLower, Set<String> hints) {
    for (final hint in hints) {
      if (hostLower == hint ||
          hostLower.endsWith('.$hint') ||
          hostLower.contains(hint)) {
        return true;
      }
    }
    return false;
  }

  static bool _looksLikeAdRedirectUrl(
    String lower,
    String hostLower, {
    required bool isTrustedHost,
  }) {
    if (isTrustedHost) {
      return false;
    }

    final hasSuspiciousTld = hostLower.endsWith('.cyou') ||
        hostLower.endsWith('.top') ||
        hostLower.endsWith('.xyz') ||
        hostLower.endsWith('.click') ||
        hostLower.endsWith('.shop') ||
        hostLower.endsWith('.live');
    final hasAdLikePath = lower.contains('/cx/') ||
        lower.contains('/uc*') ||
        lower.contains('md=') ||
        lower.contains('clickid=') ||
        lower.contains('zoneid=');

    return hasSuspiciousTld && hasAdLikePath;
  }

  static bool _containsVideoPathHint(String lower) {
    return lower.contains('.m3u8') ||
        lower.contains('.mp4') ||
        lower.contains('.m4v') ||
        lower.contains('.webm') ||
        lower.contains('/hls/') ||
        lower.contains('/video/') ||
        lower.contains('/stream/');
  }

  static bool _containsSubtitlePathHint(String lower) {
    return lower.contains('.vtt') ||
        lower.contains('.srt') ||
        lower.contains('.ass') ||
        lower.contains('.ssa') ||
        lower.contains('subtitle') ||
        lower.contains('caption') ||
        lower.contains('/sub/') ||
        lower.contains('/cc/');
  }

  static bool _containsIgnoredAssetHint(String lower) {
    if (lower.endsWith('.js') ||
        lower.endsWith('.css') ||
        lower.endsWith('.html') ||
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.gif') ||
        lower.endsWith('.webp') ||
        lower.endsWith('.svg') ||
        lower.contains('doubleclick') ||
        lower.contains('googlesyndication') ||
        lower.contains('google-analytics') ||
        lower.contains('/analytics') ||
        lower.contains('/ads/') ||
        lower.contains('prebid')) {
      return true;
    }
    return false;
  }

  static bool _isLikelyEmbedPageUrl(
    String url, {
    required String contextPageUrl,
    required _ExtractionProfile profile,
  }) {
    final uri = Uri.tryParse(url);
    if (uri == null || uri.host.isEmpty) {
      return false;
    }

    final scheme = uri.scheme.toLowerCase();
    if (scheme != 'http' && scheme != 'https') {
      return false;
    }

    final lower = url.toLowerCase();
    if (_containsIgnoredAssetHint(lower)) {
      return false;
    }
    if (_isLikelyVideoUrl(url, profile: profile) ||
        _isLikelySubtitleUrl(url, profile: profile)) {
      return false;
    }

    final hostLower = uri.host.toLowerCase();
    if (_isLocalOrReservedHost(hostLower) ||
        _isBlockedHost(hostLower, profile: profile)) {
      return false;
    }

    final contextHost = Uri.tryParse(contextPageUrl)?.host.toLowerCase() ?? '';
    final trustedHost = _hasHostHint(hostLower, profile.embedHostHints) ||
        _hasHostHint(hostLower, profile.trustedMediaHostHints) ||
        (contextHost.isNotEmpty &&
            (hostLower == contextHost ||
                hostLower.endsWith('.$contextHost') ||
                contextHost.endsWith('.$hostLower')));
    if (!trustedHost) {
      return false;
    }

    return lower.contains('/embed/') ||
        lower.contains('/player') ||
        lower.contains('/watch') ||
        lower.contains('/source') ||
        lower.contains('tmdb=') ||
        lower.contains('imdb=') ||
        lower.contains('season=') ||
        lower.contains('episode=') ||
        lower.contains('autoplay=') ||
        lower.contains('autonext=') ||
        lower.contains('server=') ||
        lower.contains('sbx') ||
        (profile.allowEmbedPathFallback && lower.contains('iframe'));
  }

  static List<String> _rankEmbedPageCandidates(
    Set<String> capturedPageUrls, {
    required String currentPageUrl,
    required Set<String> visitedPages,
    required _ExtractionProfile profile,
  }) {
    final currentKey = _normalizeTraversalPageKey(currentPageUrl);
    final candidates = capturedPageUrls.where((url) {
      final key = _normalizeTraversalPageKey(url);
      if (key.isEmpty || key == currentKey) {
        return false;
      }
      return !visitedPages.contains(key);
    }).toList(growable: false)
      ..sort(
        (a, b) =>
            _embedPageCandidateScore(
              b,
              profile: profile,
            ) -
            _embedPageCandidateScore(
              a,
              profile: profile,
            ),
      );

    if (candidates.length <= _maxNestedPageCandidates) {
      return candidates;
    }
    return candidates.take(_maxNestedPageCandidates).toList(growable: false);
  }

  static int _embedPageCandidateScore(
    String url, {
    required _ExtractionProfile profile,
  }) {
    final lower = url.toLowerCase();
    var score = 0;

    if (lower.contains('/embed/')) score += 100;
    if (lower.contains('/player')) score += 70;
    if (lower.contains('tmdb=')) score += 60;
    if (lower.contains('imdb=')) score += 60;
    if (lower.contains('season=')) score += 45;
    if (lower.contains('episode=')) score += 45;
    if (lower.contains('autoplay=')) score += 25;
    if (lower.contains('autonext=')) score += 20;
    if (lower.contains('.m3u8')) score += 90;
    for (final hint in profile.embedHostHints) {
      if (hint.isNotEmpty && lower.contains(hint)) {
        score += 40;
      }
    }
    if (lower.contains('/ads/') || lower.contains('analytics')) score -= 200;

    return score;
  }

  static String _normalizeTraversalPageKey(String url) {
    return url.trim().toLowerCase();
  }

  static List<String> _rankPlaylistCandidates(
    Set<String> capturedUrls, {
    required _ExtractionProfile profile,
  }) {
    final candidates = capturedUrls
        .where(
          (url) =>
              _isLikelyVideoUrl(url, profile: profile) &&
              url.toLowerCase().contains('.m3u8'),
        )
        .toList(growable: false)
      ..sort((a, b) => _playlistCandidateScore(b) - _playlistCandidateScore(a));
    return candidates;
  }

  static int _playlistCandidateScore(String url) {
    final lower = url.toLowerCase();
    var score = 0;

    if (lower.contains('master')) score += 120;
    if (lower.contains('playlist')) score += 55;
    if (lower.contains('index')) score += 30;
    if (lower.contains('manifest')) score += 30;
    if (lower.contains('.m3u8')) score += 20;

    if (lower.contains('chunklist')) score -= 20;
    if (lower.contains('audio')) score -= 30;
    if (lower.contains('subtitle') || lower.contains('caption')) score -= 80;

    if (lower.contains('token=') ||
        lower.contains('sig=') ||
        lower.contains('signature=')) {
      score += 5;
    }

    return score;
  }

  /// True when [url] is a high-confidence master HLS playlist on a trusted
  /// media host — an obvious "start playing now" candidate. Used to shorten the
  /// capture debounce so the happy path doesn't pay the full quiet-window wait.
  static bool _isHighConfidencePlaylist(
    String url, {
    required _ExtractionProfile profile,
  }) {
    final lower = url.toLowerCase();
    if (!lower.contains('.m3u8')) return false;
    // Reuse the ranker: master/playlist/index/manifest signals push score up,
    // chunklist/audio/subtitle push it down. Require a clearly-master score.
    if (_playlistCandidateScore(url) < 50) return false;
    final host = Uri.tryParse(url)?.host.toLowerCase() ?? '';
    if (host.isEmpty) return false;
    return _hasHostHint(host, profile.trustedMediaHostHints);
  }

  static List<String> _rankDirectVideoCandidates(
    Set<String> capturedUrls, {
    required _ExtractionProfile profile,
  }) {
    final candidates = capturedUrls
        .where((url) => _isLikelyVideoUrl(url, profile: profile))
        .toList(growable: false)
      ..sort(
        (a, b) => _directVideoCandidateScore(b) - _directVideoCandidateScore(a),
      );
    return candidates;
  }

  static int _directVideoCandidateScore(String url) {
    final lower = url.toLowerCase();
    var score = 0;
    if (lower.contains('.m3u8')) score += 30;
    if (lower.contains('.mp4')) score += 20;
    if (lower.contains('master')) score += 10;
    if (lower.contains('subtitle') || lower.contains('caption')) score -= 60;
    return score;
  }

  static StreamInfo _buildFallbackInfo(
    Set<String> capturedUrls,
    Set<String> capturedSubUrls, {
    required _ExtractionProfile profile,
  }) {
    final videoCandidates = _rankDirectVideoCandidates(
      capturedUrls,
      profile: profile,
    );
    debugPrint(
      '[StreamExtractor] Fallback video candidates: '
      '${_previewList(videoCandidates)}',
    );

    final tracks = videoCandidates
        .map((url) => StreamTrack(url: url, label: _guessLabel(url)))
        .toList(growable: false);

    final subtitleCandidates = capturedSubUrls
        .where((url) => _isLikelySubtitleUrl(url, profile: profile))
        .toSet();
    final subs = subtitleCandidates
        .map(
          (url) => SubtitleTrack(
            url: url,
            label: _guessSubLabel(url),
            language: _guessSubLang(url),
          ),
        )
        .toList(growable: false);

    return StreamInfo(videoTracks: tracks, subtitleTracks: subs);
  }

  static String _previewList(Iterable<String> values) {
    final list = values.toList(growable: false);
    if (list.isEmpty) return '(none)';
    final preview = list.take(_maxPreviewCandidates).join(' | ');
    if (list.length <= _maxPreviewCandidates) {
      return preview;
    }
    return '$preview | ... (${list.length} total)';
  }

  // ── Legacy single-URL helper (kept for backwards compat) ──────────────────
  static Future<String?> extractStream(
    String url, {
    Duration timeout = const Duration(seconds: 10),
    Future<void>? cancelSignal,
  }) async {
    final info = await extractStreamInfo(
      url,
      timeout: timeout,
      cancelSignal: cancelSignal,
    );
    return info?.bestUrl;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /// Fetches and parses a master HLS playlist.
  static Future<StreamInfo?> _parseMasterPlaylist(
    String masterUrl,
    Set<String> capturedSubUrls, {
    required String requestContextUrl,
  }) async {
    debugPrint('[StreamExtractor] Parsing master playlist: $masterUrl');

    final List<StreamTrack> videoTracks = [];
    final List<SubtitleTrack> subtitleTracks = [];

    try {
      final body = await _fetchPlaylistBody(masterUrl, requestContextUrl);
      if (body == null || body.isEmpty) {
        debugPrint('[StreamExtractor] Empty playlist response for $masterUrl');
        return null;
      }

      if (!body.contains('#EXTM3U')) {
        debugPrint(
            '[StreamExtractor] Candidate is not a valid m3u8: $masterUrl');
        return null;
      } else if (!body.contains('#EXT-X-STREAM-INF')) {
        // It's a media playlist (not master) — single track
        videoTracks.add(StreamTrack(url: masterUrl, label: 'Auto'));
        // Still try to parse subtitles from it
        _parseMediaSubtitles(body, masterUrl, subtitleTracks);
      } else {
        // --- Parse multi-variant master playlist ---
        _parseMasterVariants(body, masterUrl, videoTracks);
        _parseMasterSubtitles(body, masterUrl, subtitleTracks);
      }
    } catch (e, stack) {
      debugPrint('[StreamExtractor] Failed to parse playlist $masterUrl: $e');
      debugPrint(stack.toString());
      return null;
    }

    // Merge any subtitle URLs captured by JS interception
    for (final subUrl in capturedSubUrls) {
      if (!subtitleTracks.any((s) => s.url == subUrl)) {
        subtitleTracks.add(
          SubtitleTrack(
            url: subUrl,
            label: _guessSubLabel(subUrl),
            language: _guessSubLang(subUrl),
          ),
        );
      }
    }

    // Sort video tracks highest resolution first
    videoTracks.sort((a, b) {
      final bH = b.height ?? b.bandwidth ?? 0;
      final aH = a.height ?? a.bandwidth ?? 0;
      return bH.compareTo(aH);
    });

    if (videoTracks.isEmpty) {
      videoTracks.add(StreamTrack(url: masterUrl, label: 'Auto'));
    }

    return StreamInfo(videoTracks: videoTracks, subtitleTracks: subtitleTracks);
  }

  static Future<String?> _fetchPlaylistBody(
    String playlistUrl,
    String requestContextUrl,
  ) async {
    final response = await _getWithHeaderFallback(
      pageUrl: requestContextUrl,
      requestUrl: playlistUrl,
    );

    if (response == null) {
      return null;
    }

    if (response.statusCode < 200 || response.statusCode >= 400) {
      debugPrint(
        '[StreamExtractor] Playlist request failed with status '
        '${response.statusCode}: $playlistUrl',
      );
      return null;
    }

    return response.body;
  }

  static Future<http.Response?> _getWithHeaderFallback({
    required String pageUrl,
    required String requestUrl,
  }) async {
    final uri = Uri.tryParse(requestUrl);
    if (uri == null || uri.host.isEmpty) {
      return null;
    }

    http.Response? lastResponse;
    for (final headers in _requestHeaderAttempts(pageUrl, requestUrl)) {
      try {
        final response = await http
            .get(uri, headers: headers)
            .timeout(const Duration(seconds: 8));
        lastResponse = response;
        if (response.statusCode >= 200 && response.statusCode < 400) {
          return response;
        }
      } catch (_) {
        // Continue with next header strategy.
      }
    }
    return lastResponse;
  }

  static List<Map<String, String>> _requestHeaderAttempts(
    String pageUrl,
    String requestUrl,
  ) {
    final normalizedPageUrl = pageUrl.trim();
    final pageReferer = _normalizeReferer(normalizedPageUrl);
    final requestOrigin = _originFor(requestUrl);

    final candidates = <Map<String, String>>[
      _requestHeaders(pageUrl, requestUrl),
      {
        HttpHeaders.userAgentHeader: _desktopUserAgent,
        if (pageReferer.isNotEmpty) HttpHeaders.refererHeader: pageReferer,
      },
      {
        HttpHeaders.userAgentHeader: _desktopUserAgent,
        if (requestOrigin.isNotEmpty)
          HttpHeaders.refererHeader: '$requestOrigin/',
        if (requestOrigin.isNotEmpty) 'Origin': requestOrigin,
      },
      {
        HttpHeaders.userAgentHeader: _desktopUserAgent,
      },
    ];

    final signatures = <String>{};
    final unique = <Map<String, String>>[];
    for (final headers in candidates) {
      final entries = headers.entries.toList()
        ..sort((a, b) => a.key.compareTo(b.key));
      final signature = entries.map((e) => '${e.key}=${e.value}').join('&');
      if (signatures.add(signature)) {
        unique.add(headers);
      }
    }

    return unique;
  }

  static Map<String, String> _requestHeaders(
    String pageUrl,
    String requestUrl,
  ) {
    final normalizedPageUrl = pageUrl.trim();
    final pageReferer = _normalizeReferer(normalizedPageUrl);
    final pageOrigin = _originFor(normalizedPageUrl);
    final requestOrigin = _originFor(requestUrl);

    return {
      HttpHeaders.userAgentHeader: _desktopUserAgent,
      if (pageReferer.isNotEmpty) HttpHeaders.refererHeader: pageReferer,
      if (pageOrigin.isNotEmpty)
        'Origin': pageOrigin
      else if (requestOrigin.isNotEmpty)
        'Origin': requestOrigin,
    };
  }

  static String _normalizeReferer(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null || uri.host.isEmpty) {
      return url;
    }
    if (uri.path.isEmpty) {
      return '${uri.scheme}://${uri.host}/';
    }
    return uri.toString();
  }

  static String _originFor(String url) {
    final uri = Uri.tryParse(url.trim());
    if (uri == null || uri.host.isEmpty) return '';
    return '${uri.scheme}://${uri.host}';
  }

  static void _parseMasterVariants(
    String body,
    String masterUrl,
    List<StreamTrack> out,
  ) {
    final lines = body.split('\n').map((l) => l.trim()).toList();
    for (int i = 0; i < lines.length - 1; i++) {
      final line = lines[i];
      if (!line.startsWith('#EXT-X-STREAM-INF')) continue;

      // Next non-empty line is the chunk URL
      String? chunkUrl;
      for (int j = i + 1; j < lines.length; j++) {
        if (lines[j].isNotEmpty && !lines[j].startsWith('#')) {
          chunkUrl = lines[j];
          break;
        }
      }
      if (chunkUrl == null) continue;

      // Resolve relative URL
      final resolvedUrl = _resolveUrl(masterUrl, chunkUrl);

      // Parse attributes
      final bandwidth = _parseAttrInt(line, 'BANDWIDTH');
      final resolution =
          _parseAttrString(line, 'RESOLUTION'); // e.g. "1920x1080"
      int? width, height;
      String label = 'Auto';

      if (resolution != null) {
        final parts = resolution.split('x');
        if (parts.length == 2) {
          width = int.tryParse(parts[0]);
          height = int.tryParse(parts[1]);
          label = height != null ? '${height}p' : resolution;
        }
      } else if (bandwidth != null) {
        label = '${(bandwidth / 1000).round()}k';
      }

      // Avoid duplicates
      if (!out.any((t) => t.url == resolvedUrl)) {
        out.add(
          StreamTrack(
            url: resolvedUrl,
            label: label,
            bandwidth: bandwidth,
            width: width,
            height: height,
          ),
        );
      }
    }
  }

  static void _parseMasterSubtitles(
    String body,
    String masterUrl,
    List<SubtitleTrack> out,
  ) {
    // #EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="en",NAME="English",URI="en.m3u8"
    final lines = body.split('\n').map((l) => l.trim()).toList();
    for (final line in lines) {
      if (!line.startsWith('#EXT-X-MEDIA')) continue;
      final type = _parseAttrString(line, 'TYPE');
      if (type != 'SUBTITLES' && type != 'CLOSED-CAPTIONS') continue;

      final uriAttr = _parseAttrString(line, 'URI');
      if (uriAttr == null) continue;

      final resolvedUrl = _resolveUrl(masterUrl, uriAttr);
      final lang = _parseAttrString(line, 'LANGUAGE') ?? 'und';
      final name = _parseAttrString(line, 'NAME') ?? lang.toUpperCase();

      if (!out.any((s) => s.url == resolvedUrl)) {
        out.add(SubtitleTrack(url: resolvedUrl, label: name, language: lang));
      }
    }
  }

  // ignore: unused_element
  static void _parseMediaSubtitles(
    // ignore: avoid_unused_constructor_parameters
    String body,
    // ignore: avoid_unused_constructor_parameters
    String baseUrl,
    List<SubtitleTrack> out,
  ) {
    // Deep WEBVTT segment parsing is not needed here —
    // JS interception captures subtitle URLs at runtime.
    out.addAll([]);
  }

  static String _resolveUrl(String base, String relative) {
    if (relative.startsWith('http://') || relative.startsWith('https://')) {
      return relative;
    }
    final baseUri = Uri.parse(base);
    if (relative.startsWith('/')) {
      return '${baseUri.scheme}://${baseUri.host}$relative';
    }
    // Relative to directory
    final dir = base.substring(0, base.lastIndexOf('/') + 1);
    return '$dir$relative';
  }

  static int? _parseAttrInt(String line, String key) {
    final pattern = RegExp('$key=(\\d+)');
    final match = pattern.firstMatch(line);
    return match != null ? int.tryParse(match.group(1)!) : null;
  }

  static String? _parseAttrString(String line, String key) {
    final pattern = RegExp('$key="([^"]*)"');
    final match = pattern.firstMatch(line);
    if (match != null) return match.group(1);
    // unquoted
    final pattern2 = RegExp('$key=([^,\\s]+)');
    final match2 = pattern2.firstMatch(line);
    return match2?.group(1);
  }

  static String _guessLabel(String url) {
    final lower = url.toLowerCase();
    for (final q in ['2160', '1080', '720', '480', '360', '240']) {
      if (lower.contains(q)) return '${q}p';
    }
    return 'Auto';
  }

  static String _guessSubLabel(String url) {
    final lower = url.toLowerCase();
    if (lower.contains('english') ||
        lower.contains('/en/') ||
        lower.contains('_en.')) {
      return 'English';
    }
    if (lower.contains('spanish') || lower.contains('/es/')) {
      return 'Spanish';
    }
    if (lower.contains('french') || lower.contains('/fr/')) {
      return 'French';
    }
    if (lower.contains('german') || lower.contains('/de/')) {
      return 'German';
    }
    if (lower.contains('arabic') || lower.contains('/ar/')) {
      return 'Arabic';
    }
    return 'Subtitles';
  }

  static String _guessSubLang(String url) {
    final lower = url.toLowerCase();
    if (lower.contains('english') || lower.contains('/en')) {
      return 'en';
    }
    if (lower.contains('spanish') || lower.contains('/es')) {
      return 'es';
    }
    if (lower.contains('french') || lower.contains('/fr')) {
      return 'fr';
    }
    if (lower.contains('german') || lower.contains('/de')) {
      return 'de';
    }
    if (lower.contains('arabic') || lower.contains('/ar')) {
      return 'ar';
    }
    return 'und';
  }

  // ── JavaScript injection ────────────────────────────────────────────────--

  static String _buildInjectionScript() => r'''
(function() {
  const _MAX_POSTS = 600;
  const _MAX_CAPTURED_URL_LENGTH = 2048;
  const _MAX_TEXT_SCAN_LENGTH = 20000;
  const _seenUrls = new Set();
  let _postCount = 0;

  function _normalize(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let value = raw.trim();
    if (!value) return '';

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).trim();
    }

    value = value
      .replace(/\\u0026/gi, '&')
      .replace(/\\u003d/gi, '=')
      .replace(/\\u002f/gi, '/')
      .replace(/\\\//g, '/')
      .replace(/&amp;/gi, '&');

    return value;
  }

  function _post(url) {
    const normalized = _normalize(url);
    if (!normalized ||
        normalized.length > _MAX_CAPTURED_URL_LENGTH ||
        _seenUrls.has(normalized) ||
        _postCount >= _MAX_POSTS) return;
    _seenUrls.add(normalized);
    _postCount += 1;
    try {
      if (window.flutter_inappwebview) {
        window.flutter_inappwebview.callHandler('ExtractorChannel', normalized);
      } else if (window.ExtractorChannel) {
        ExtractorChannel.postMessage(normalized);
      }
    } catch(_) {}
  }

  function _maybePost(url) {
    const normalized = _normalize(url);
    if (!normalized) return;

    const lower = normalized.toLowerCase();
    const isVideo = (lower.includes('.m3u8') ||
                     lower.includes('.mp4') ||
                     lower.includes('.m4v') ||
                     lower.includes('.webm'))
                    && !lower.endsWith('.js')
                    && !lower.endsWith('.css')
                    && !lower.endsWith('.png')
                    && !lower.endsWith('.jpg')
                    && !lower.endsWith('.jpeg')
                    && !lower.endsWith('.gif')
                    && !lower.endsWith('.webp')
                    && !lower.endsWith('.html');
    const isSub = lower.includes('.vtt') ||
                  lower.includes('.srt') ||
                  lower.includes('.ass') ||
                  lower.includes('.ssa') ||
                  lower.includes('subtitle') ||
                  lower.includes('caption') ||
                  lower.includes('/sub/') ||
                  lower.includes('/cc/');
    const isEmbedPage = !isVideo && !isSub && (
      lower.includes('/embed/') ||
      lower.includes('/player') ||
      lower.includes('/watch') ||
      lower.includes('/source') ||
      lower.includes('tmdb=') ||
      lower.includes('imdb=') ||
      lower.includes('season=') ||
      lower.includes('episode=') ||
      lower.includes('autoplay=') ||
      lower.includes('autonext=') ||
      lower.includes('server=') ||
      lower.includes('sbx')
    );
    if (isVideo || isSub || isEmbedPage) {
      _post(normalized);
    }
  }

  function _extractFromText(text) {
    if (!text || typeof text !== 'string') return;

    if (text.length > _MAX_TEXT_SCAN_LENGTH) {
      text = text.slice(0, _MAX_TEXT_SCAN_LENGTH);
    }

    const rawMatches = text.match(/https?:\/\/[^\s"'<>\\]+/gi) || [];
    rawMatches.forEach((u) => _maybePost(u));

    const escapedMatches = text.match(/https?:\\\/\\\/[^"'\s<>\\]+/gi) || [];
    escapedMatches.forEach((u) => _maybePost(u.replace(/\\\//g, '/')));
  }

  function _walk(value) {
    if (value == null) return;
    if (typeof value === 'string') {
      _maybePost(value);
      _extractFromText(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(_walk);
      return;
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach((key) => _walk(value[key]));
    }
  }

  function _extractFromAny(value) {
    if (value == null) return;
    _walk(value);

    if (typeof value === 'string') {
      try {
        _walk(JSON.parse(value));
      } catch(_) {}
    }
  }

  // ── Intercept fetch (URL + response body) ───────────────────────────────
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const requestUrl = typeof args[0] === 'string' ? args[0]
      : (args[0] && args[0].url) ? args[0].url : '';

    _maybePost(requestUrl);

    const resp = await origFetch.apply(this, args);
    _maybePost(resp && resp.url ? resp.url : '');

    try {
      const clone = resp.clone();
      clone.text().then((body) => {
        _extractFromText(body);
        try {
          _extractFromAny(JSON.parse(body));
        } catch(_) {}
      }).catch(() => {});
    } catch(_) {}

    return resp;
  };

  // ── Intercept XHR ────────────────────────────────────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__extractorUrl = url;
    _maybePost(url);
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', () => {
      try {
        _maybePost(this.responseURL || this.__extractorUrl || '');
        if (typeof this.responseText === 'string') {
          _extractFromText(this.responseText);
          try {
            _extractFromAny(JSON.parse(this.responseText));
          } catch(_) {}
        }
      } catch(_) {}
    });
    return origSend.apply(this, arguments);
  };

  // ── Listen for postMessage from embedded players ────────────────────────
  window.addEventListener('message', function(event) {
    try {
      if (typeof event.data === 'string' &&
          event.data.length > _MAX_TEXT_SCAN_LENGTH) {
        _extractFromText(event.data);
        return;
      }
      _extractFromAny(event.data);
    } catch(_) {}
  }, true);

  // ── Scan resource timing entries ────────────────────────────────────────
  function scanPerformanceEntries() {
    try {
      const entries = performance.getEntriesByType('resource') || [];
      entries.forEach((entry) => _maybePost(entry && entry.name ? entry.name : ''));
    } catch(_) {}
  }

  // ── Scan DOM / scripts / iframes ────────────────────────────────────────
  function scanDocument(doc) {
    if (!doc) return;

    try {
      doc.querySelectorAll('video').forEach((video) => {
        _maybePost(video.src);
        video.querySelectorAll('source').forEach((source) => _maybePost(source.src));
        video.querySelectorAll('track').forEach((track) => _maybePost(track.src));
      });

      doc.querySelectorAll('iframe').forEach((iframe) => {
        _maybePost(iframe.src);
        try {
          const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
          scanDocument(frameDoc);
        } catch(_) {}
      });

      doc.querySelectorAll('[src],[data-src],[href]').forEach((node) => {
        _maybePost(node.getAttribute('src'));
        _maybePost(node.getAttribute('data-src'));
        _maybePost(node.getAttribute('href'));
      });

      doc.querySelectorAll('script').forEach((script) => {
        _maybePost(script.src);
        if (script.textContent) {
          _extractFromText(script.textContent);
        }
      });
    } catch(_) {}
  }

  scanPerformanceEntries();
  scanDocument(document);

  setInterval(scanPerformanceEntries, 3000);
  setInterval(() => scanDocument(document), 1000);
})();
''';
}
