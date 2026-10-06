import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRenderer, defineComponent, h, nextTick, ref, type Ref } from "vue";
import { useCursor } from "./useCursor";

// A renderer without a DOM: enough to give each component a real instance and uid.
const { createApp } = createRenderer<object, object>({
  insert() {},
  remove() {},
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  setText() {},
  setElementText() {},
  parentNode: () => null,
  nextSibling: () => null,
  patchProp() {},
});

describe("useCursor", () => {
  const body = { style: { cursor: "auto" } };
  beforeEach(() => vi.stubGlobal("document", { body }));
  afterEach(() => vi.unstubAllGlobals());

  it("shows the pointer after moving from a house straight onto its tower", async () => {
    const hovered: Record<string, Ref<boolean>> = {};
    const Item = defineComponent({
      props: { name: { type: String, required: true } },
      setup(props) {
        hovered[props.name] = ref(false);
        useCursor(hovered[props.name]);
        return () => null;
      },
    });
    // The tower renders before its houses, so its instance is created first.
    createApp({ render: () => h("group", [h(Item, { name: "tower" }), h(Item, { name: "house" })]) }).mount({});

    hovered.house.value = true;
    await nextTick();
    expect(body.style.cursor).toBe("pointer");

    // One pointer-events commit: pointerout on the house, then pointerover on the tower.
    hovered.house.value = false;
    hovered.tower.value = true;
    await nextTick();
    expect(body.style.cursor).toBe("pointer");
  });
});
