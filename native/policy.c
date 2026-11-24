/* Keys are webOS remote codes; actions are dispatched by the DOM adapter. */
int key_action(int key) {
    switch (key) {
    case 404:
    case 172:
        return 1; /* settings */
    case 406:
    case 167:
    case 191:
        return 2; /* audio-only */
    case 403:
    case 405:
    case 170:
        return 3; /* other color key */
    default:
        return 0;
    }
}
int playback_events(int has_id, int new_video, int playing, int was_playing) {
    if (!has_id)
        return 0;
    return (new_video ? 1 : 0) | ((playing && (new_video || !was_playing)) ? 2 : 0);
}
int player_mode(int inline_player, int shorts) {
    return inline_player ? 0 : shorts ? 1 : 2;
}
