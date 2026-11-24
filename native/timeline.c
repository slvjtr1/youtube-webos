/* One module instance per video. The freestanding Wasm heap belongs to this index. */
#include <stddef.h>
#include <stdint.h>

typedef struct {
    double start, end;
    int source;
} Segment;
extern unsigned char __heap_base;
static unsigned count;
static Segment *entries(void) {
    return (Segment *)(void *)&__heap_base;
}
unsigned capacity(void) {
    return ((__builtin_wasm_memory_size(0) * 65536u) - (uintptr_t)entries()) / sizeof(Segment);
}
int add_segment(double start, double end, int source) {
    if (!__builtin_isfinite(start) || !__builtin_isfinite(end) || end <= start)
        return 0;
    if (count >= capacity() && __builtin_wasm_memory_grow(0, 1) == (size_t)-1)
        return -1;
    entries()[count++] = (Segment){start, end, source};
    return 1;
}
static int later(Segment a, Segment b) {
    return a.start > b.start || (a.start == b.start && a.source > b.source);
}
static void sift(Segment *rows, unsigned root, unsigned size) {
    Segment value = rows[root];
    while (root < size / 2) {
        unsigned child = root * 2 + 1;
        if (child + 1 < size && later(rows[child + 1], rows[child]))
            child++;
        if (!later(rows[child], value))
            break;
        rows[root] = rows[child];
        root = child;
    }
    rows[root] = value;
}
void finish_index(void) {
    Segment *rows = entries();
    for (unsigned i = count / 2; i; i--)
        sift(rows, i - 1, count);
    for (unsigned size = count; size > 1;) {
        Segment top = rows[0];
        rows[0] = rows[--size];
        rows[size] = top;
        sift(rows, 0, size);
    }
}
int next_segment(double now) {
    Segment *rows = entries();
    unsigned low = 0, high = count;
    while (low < high) {
        unsigned mid = low + (high - low) / 2;
        if (rows[mid].start <= now - 0.3)
            low = mid + 1;
        else
            high = mid;
    }
    for (; low < count; low++)
        if (rows[low].end > now)
            return rows[low].source;
    return -1;
}
double skip_delay(double now, double start, double rate) {
    return start <= now ? 0 : (start - now) * 1000 / rate;
}
int keep_deadline(int same, double old_due, double due) {
    return same && __builtin_fabs(old_due - due) < 60;
}
int can_skip(double now, double start, double end, int paused, int seeking) {
    return !paused && !seeking && now >= start - 0.05 && now < end;
}
