#include "options.h"

typedef struct {
    const char *key, *description, *category;
    int initial;
} Option;
static const Option options[] = {
    [ENABLE_ADBLOCK] = {"enableAdBlock", "Enable ad blocking", "", 1},
    {"upgradeThumbnails", "Upgrade thumbnail quality", "", 0},
    {"hideLogo", "Hide YouTube logo", "", 0},
    {"showWatch", "Display time in UI", "", 0},
    [REMOVE_SHORTS] = {"removeShorts", "Remove Shorts from subscriptions", "", 0},
    {"forceHighResVideo", "Force max resolution video playback", "", 0},
    [REMOVE_ENDSCREEN] = {"removeEndscreen", "Remove end screens from video", "", 0},
    {"autoAccountSelect", "Bypass initial account selection on startup", "", 0},
    {"enableSponsorBlock", "Enable SponsorBlock", "", 1},
    {"enableSponsorBlockSponsor", "Skip sponsor segments", "sponsor", 1},
    {"enableSponsorBlockIntro", "Skip intro segments", "intro", 1},
    {"enableSponsorBlockOutro", "Skip outro segments", "outro", 1},
    {"enableSponsorBlockInteraction", "Skip interaction reminder segments", "interaction", 1},
    {"enableSponsorBlockSelfPromo", "Skip self promotion segments", "selfpromo", 1},
    {"enableSponsorBlockMusicOfftopic", "Skip non-music segments in music videos", "music_offtopic",
     1},
    {"enableSponsorBlockPreview", "Skip recaps and previews", "preview", 0},
};
static unsigned enabled;
int option_count(void) {
    return sizeof options / sizeof *options;
}
const char *option_key(int i) {
    return options[i].key;
}
const char *option_desc(int i) {
    return options[i].description;
}
const char *option_category(int i) {
    return options[i].category;
}
int option_read(int i) {
    return (enabled >> i) & 1;
}
void option_write(int i, int value) {
    if (value)
        enabled |= 1u << i;
    else
        enabled &= ~(1u << i);
}
void options_init(void) {
    for (int i = 0; i < option_count(); i++)
        option_write(i, options[i].initial);
}

/* The settings panel has one vertical list and an indented SponsorBlock group.
 * Nonnegative results are checkbox indices. Negative results are panel actions. */
enum { KEEP = -1, ACTIVATE = -2, CLOSE = -3 };

int panel_key(int key, int current, int count, int group_start) {
    if (key == 27 || key == 461)
        return CLOSE;
    if (count <= 0)
        return KEEP;
    if (key == 13)
        return current >= 0 ? ACTIVATE : 0;
    if (key == 40)
        return current + 1 < count ? current + 1 : current;
    if (key == 38)
        return current > 0 ? current - 1 : 0;
    if (key == 39 && current == group_start - 1 && group_start < count)
        return group_start;
    if (key == 37 && current >= group_start && group_start > 0)
        return group_start - 1;
    return KEEP;
}
