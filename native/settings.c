/* Read by Webpack to embed the panel layout even on TVs without Wasm. */
static const char rows[] =
    "enableAdBlock\n"
    "upgradeThumbnails\n"
    "hideLogo\n"
    "showWatch\n"
    "removeShorts\n"
    "forceHighResVideo\n"
    "removeEndscreen\n"
    "autoAccountSelect\n"
    "enableSponsorBlock"

    "\n\n"
    "enableSponsorBlockSponsor\n"
    "enableSponsorBlockIntro\n"
    "enableSponsorBlockOutro\n"
    "enableSponsorBlockInteraction\n"
    "enableSponsorBlockSelfPromo\n"
    "enableSponsorBlockMusicOfftopic\n"
    "enableSponsorBlockPreview";

const char *settings_rows(void) { return rows; }

/* The settings panel has one vertical list and an indented SponsorBlock group.
 * Nonnegative results are checkbox indices. Negative results are panel actions. */
enum { KEEP = -1, ACTIVATE = -2, CLOSE = -3 };

int panel_key(int key, int current, int count, int group_start) {
    if (key == 27 || key == 461) return CLOSE;
    if (count <= 0) return KEEP;
    if (key == 13) return current >= 0 ? ACTIVATE : 0;
    if (key == 40) return current + 1 < count ? current + 1 : current;
    if (key == 38) return current > 0 ? current - 1 : 0;
    if (key == 39 && current == group_start - 1 && group_start < count)
        return group_start;
    if (key == 37 && current >= group_start && group_start > 0)
        return group_start - 1;
    return KEEP;
}
