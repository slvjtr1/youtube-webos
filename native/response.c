/* JavaScript holds references to the browser's objects. C drives traversal and
 * decisions, without serializing or reparsing a YouTube response. Handle 0 is
 * undefined, handle 1 is the root. Rewind temporary handles after each item. */
#define HOST(name) __attribute__((import_module("env"), import_name(name)))
typedef int Handle;
extern HOST("field") Handle field(Handle, const char *);
extern HOST("find_field") Handle find_field(Handle, const char *);
extern HOST("element") Handle element(Handle, int);
extern HOST("array_length") int array_length(Handle); /* -1 for a non-array */
extern HOST("truthy") int truthy(Handle);
extern HOST("present") int present(Handle);
extern HOST("has_field") int has_field(Handle, const char *);
extern HOST("equals_text") int equals_text(Handle, const char *);
extern HOST("erase") void erase(Handle, const char *);
extern HOST("new_array") Handle new_array(void);
extern HOST("append_item") void append_item(Handle, Handle);
extern HOST("set_field") void set_field(Handle, const char *, Handle);
extern HOST("mark_handles") int mark_handles(void);
extern HOST("rewind_handles") void rewind_handles(int);
#include "options.h"

enum Operation {
    DELETE_TRUTHY,
    DELETE_ARRAY,
    DELETE_WITH_KEY,
    FILTER_TRUTHY,
    FILTER_PRESENT,
    FILTER_SHORT_SHELF
};
typedef struct {
    const char *path[14];
    enum Operation op;
    const char *test[5];
} Rule;

#define HOME                                                                                       \
    "contents", "tvBrowseRenderer", "content", "tvSurfaceContentRenderer", "content",              \
        "sectionListRenderer", "contents"
#define SEARCH "contents", "sectionListRenderer", "contents"
#define ITEMS "*", "shelfRenderer", "content", "horizontalListRenderer", "items"
static const Rule ads[] = {
    {{"adPlacements"}, DELETE_TRUTHY, {0}},
    {{"adSlots"}, DELETE_ARRAY, {0}},
    {{"playerAds"}, DELETE_TRUTHY, {0}},
    {{HOME}, FILTER_TRUTHY, {"tvMastheadRenderer"}},
    {{HOME}, FILTER_TRUTHY, {"adSlotRenderer"}},
    {{HOME, ITEMS}, FILTER_TRUTHY, {"adSlotRenderer"}},
    {{SEARCH}, FILTER_TRUTHY, {"adSlotRenderer"}},
    {{SEARCH, ITEMS}, FILTER_TRUTHY, {"adSlotRenderer"}},
    {{"entries"}, FILTER_TRUTHY, {"command", "reelWatchEndpoint", "adClientParams", "isAd"}}};
static const Rule shorts[] = {{{"?gridRenderer", "items"},
                               FILTER_PRESENT,
                               {"tileRenderer", "onSelectCommand", "reelWatchEndpoint"}},
                              {{"?gridContinuation", "items"},
                               FILTER_PRESENT,
                               {"tileRenderer", "onSelectCommand", "reelWatchEndpoint"}},
                              {{"?sectionListRenderer", "contents"},
                               FILTER_SHORT_SHELF,
                               {"shelfRenderer", "tvhtml5ShelfRendererType"}}};
static const Rule endscreen = {{"endscreen"}, DELETE_WITH_KEY, {"endscreenRenderer"}};

static int should_remove(Handle item, const Rule *rule) {
    for (const char *const *key = rule->test; item && *key; key++)
        item = field(item, *key);
    switch (rule->op) {
    case FILTER_PRESENT:
        return present(item);
    case FILTER_SHORT_SHELF:
        return equals_text(item, "TVHTML5_SHELF_RENDERER_TYPE_SHORTS");
    default:
        return truthy(item);
    }
}

static void filter_array(Handle parent, const char *key, Handle array, const Rule *rule) {
    int size = array_length(array);
    Handle filtered = 0;
    for (int i = 0; i < size; i++) {
        int mark = mark_handles();
        Handle item = element(array, i);
        int remove = should_remove(item, rule);
        if (filtered && !remove)
            append_item(filtered, item);
        rewind_handles(mark);
        if (!remove || filtered)
            continue;
        /* Allocate a replacement only when the first item needs removing. */
        filtered = new_array();
        for (int j = 0; j < i; j++) {
            int previous = mark_handles();
            append_item(filtered, element(array, j));
            rewind_handles(previous);
        }
    }
    if (filtered)
        set_field(parent, key, filtered);
}

static void apply(Handle parent, const Rule *rule, unsigned depth) {
    const char *key = rule->path[depth];
    if (!parent)
        return;
    if (key[0] == '*') {
        int size = array_length(parent);
        for (int i = 0; i < size; i++) {
            int mark = mark_handles();
            apply(element(parent, i), rule, depth + 1);
            rewind_handles(mark);
        }
        return;
    }
    Handle child = key[0] == '?' ? find_field(parent, key + 1) : field(parent, key);
    if (!child)
        return;
    if (rule->path[depth + 1]) {
        apply(child, rule, depth + 1);
        return;
    }
    switch (rule->op) {
    case DELETE_TRUTHY:
        if (truthy(child))
            erase(parent, key);
        break;
    case DELETE_ARRAY:
        if (array_length(child) >= 0)
            erase(parent, key);
        break;
    case DELETE_WITH_KEY:
        if (has_field(child, rule->test[0]))
            erase(parent, key);
        break;
    default:
        filter_array(parent, key, child, rule);
        break;
    }
}

static void run(const Rule *rules, unsigned count) {
    for (unsigned i = 0; i < count; i++) {
        apply(1, rules + i, 0);
        rewind_handles(2);
    }
}
void filter_response(void) {
    if (option_read(ENABLE_ADBLOCK))
        run(ads, sizeof ads / sizeof *ads);
    if (option_read(REMOVE_SHORTS))
        run(shorts, sizeof shorts / sizeof *shorts);
    if (option_read(REMOVE_ENDSCREEN))
        run(&endscreen, 1);
}
