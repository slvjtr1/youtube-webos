#include <stddef.h>
#include <stdint.h>

/* Only the browser adapter's shared instance uses this workspace. Each video
 * index lives in a separate instance with its own memory. URL components from
 * URL and URLSearchParams are already percent-encoded ASCII. */
extern unsigned char __heap_base;
char *scratch_reserve(unsigned bytes) {
    uintptr_t base = (uintptr_t)&__heap_base;
    if (bytes > INT32_MAX - base)
        return NULL;
    unsigned pages = (base + bytes + 65535u) / 65536u;
    unsigned current = __builtin_wasm_memory_size(0);
    if (pages > current && __builtin_wasm_memory_grow(0, pages - current) == (size_t)-1)
        return NULL;
    return (char *)base;
}

static char *copy(char *out, const char *from, const char *end) {
    while (from != end && *from)
        *out++ = *from++;
    *out = 0;
    return out;
}
static int starts(const char *text, const char *prefix) {
    while (*prefix)
        if (*text++ != *prefix++)
            return 0;
    return 1;
}
static int same(const char *a, const char *b) {
    while (*a && *a == *b) {
        a++;
        b++;
    }
    return *a == *b;
}

int partial_offset(const char *target) {
    return starts(target, "v=v=") ? 2 : 0;
}

int voice_prefix_length(const char *intent) {
    int last = 0;
    for (int i = 1; intent[0] && intent[i]; i++) {
        if (intent[i - 1] == '\n' || intent[i - 1] == '\r')
            break;
        if (starts(intent + i, "Content"))
            last = i;
    }
    return last;
}

const char *launch_origin(void) {
    return "https://www.youtube.com";
}
enum { HOME, DIRECT, PARTIAL, VOICE };
char *launch_url(int kind, char *value, const char *voice_action, char *out) {
    if (kind == DIRECT)
        return value;
    char *p = copy(out, launch_origin(), NULL);
    p = copy(p, "/tv?env_forceFullAnimation=1&env_enableWebSpeech=1&env_enableVoice=1", NULL);
    if (kind == PARTIAL && *value) {
        p = copy(p, "&", NULL);
        p = copy(p, value, NULL);
    }
    if (kind == VOICE) {
        p = copy(p, "&inApp=true&vs=9", NULL);
        if (*voice_action) {
            p = copy(p, "&", NULL);
            p = copy(p, voice_action, NULL);
        }
        p = copy(p, "&launch=voice", NULL);
        if (same(voice_action, "va=search"))
            p = copy(p, "&launch=search", NULL);
        p = copy(p, "&", NULL);
        p = copy(p, value, NULL);
    }
    copy(p, "#/", NULL);
    return out;
}

static int word(char c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
}
char *thumbnail_path(const char *host, const char *path, int webp, char *out) {
    if (host[0] == 'i' && host[1] >= '0' && host[1] <= '9')
        return NULL;
    const char *format = path;
    while (*format && !starts(format, "/vi/") && !starts(format, "/vi_webp/"))
        format++;
    if (!*format)
        return NULL;
    const char *id = format + (starts(format, "/vi/") ? 3 : 8);
    const char *name = id + 1;
    while (*name && *name != '/')
        name++;
    if (name == id + 1 || !*name)
        return NULL;
    name++;
    const char *suffix;
    if (starts(name, "sddefault") || starts(name, "hqdefault") || starts(name, "mqdefault"))
        suffix = name + 9;
    else if (starts(name, "default"))
        suffix = name + 7;
    else
        return NULL;
    const char *dot = suffix;
    if (*dot == '_')
        while (word(*dot))
            dot++;
    if (*dot != '.' || !dot[1])
        return NULL;
    for (const char *p = dot + 1; *p; p++)
        if (*p < 'a' || *p > 'z')
            return NULL;

    char *p = copy(out, path, format);
    p = copy(p, webp ? "/vi_webp" : "/vi", NULL);
    p = copy(p, id, name);
    p = copy(p, "sddefault", NULL);
    p = copy(p, suffix, dot);
    copy(p, webp ? ".webp" : ".jpg", NULL);
    return same(path, out) ? NULL : out;
}
