#ifndef PLAYER_OPTIONS_H
#define PLAYER_OPTIONS_H
enum OptionIndex { ENABLE_ADBLOCK = 0, REMOVE_SHORTS = 4, REMOVE_ENDSCREEN = 6 };
int option_read(int index);
#endif
