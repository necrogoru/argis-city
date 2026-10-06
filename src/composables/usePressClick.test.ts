import { describe, expect, it, vi } from "vitest";
import { notePress, usePressClick } from "./usePressClick";

const at = (clientX: number, clientY: number) => ({ clientX, clientY });
const event = (nativeEvent: { clientX: number; clientY: number }) => ({ nativeEvent, stopPropagation: vi.fn() });

describe("usePressClick", () => {
  it("fires when released within 6 px of the press, however long it was held", () => {
    const onClick = vi.fn();
    const press = usePressClick(onClick);
    const down = at(100, 100);
    notePress(down);
    press.onPointerdown(event(down));
    press.onPointerup(event(at(104, 103))); // 5 px
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores a camera drag beyond the tolerance", () => {
    const onClick = vi.fn();
    const press = usePressClick(onClick);
    const down = at(100, 100);
    notePress(down);
    press.onPointerdown(event(down));
    press.onPointerup(event(at(105, 105))); // 7.07 px
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ignores a release whose press started on something else", () => {
    const onClick = vi.fn();
    const press = usePressClick(onClick);
    const here = at(100, 100);
    notePress(here);
    press.onPointerdown(event(here)); // released elsewhere: no pointerup here
    const elsewhere = at(300, 300);
    notePress(elsewhere); // a later press on another object
    press.onPointerup(event(at(300, 301)));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stops propagation only when asked", () => {
    const press = usePressClick(() => {}, { stop: true });
    const down = event(at(1, 1));
    notePress(down.nativeEvent);
    press.onPointerdown(down);
    expect(down.stopPropagation).toHaveBeenCalled();
    const plain = event(at(1, 1));
    usePressClick(() => {}).onPointerdown(plain);
    expect(plain.stopPropagation).not.toHaveBeenCalled();
  });
});
