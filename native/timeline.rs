#![no_std]

use core::{panic::PanicInfo, ptr::addr_of_mut};

#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

#[derive(Clone, Copy)]
struct Segment {
    start: f64,
    end: f64,
    source: i32,
}

// Each player owns a separate Wasm instance. Longer timelines use the JS index.
const LIMIT: usize = 256;
static mut SEGMENTS: [Segment; LIMIT] = [Segment {
    start: 0.,
    end: 0.,
    source: 0,
}; LIMIT];
static mut COUNT: usize = 0;

#[no_mangle]
pub extern "C" fn capacity() -> usize {
    LIMIT
}

#[no_mangle]
pub extern "C" fn add_segment(start: f64, end: f64, source: i32) {
    // Single-threaded instance, no host calls while holding the slice.
    unsafe {
        if COUNT < LIMIT {
            (*addr_of_mut!(SEGMENTS))[COUNT] = Segment { start, end, source };
            COUNT += 1;
        }
    }
}

#[no_mangle]
pub extern "C" fn finish_index() {
    unsafe {
        let entries = &mut (&mut *addr_of_mut!(SEGMENTS))[..COUNT];
        entries.sort_unstable_by(|a, b| a.start.total_cmp(&b.start).then(a.source.cmp(&b.source)));
    }
}

#[no_mangle]
pub extern "C" fn next_segment(now: f64) -> i32 {
    unsafe {
        let entries = &(&*core::ptr::addr_of!(SEGMENTS))[..COUNT];
        let first = entries.partition_point(|entry| entry.start <= now - 0.3);
        entries[first..]
            .iter()
            .find(|entry| entry.end > now)
            .map_or(-1, |entry| entry.source)
    }
}
