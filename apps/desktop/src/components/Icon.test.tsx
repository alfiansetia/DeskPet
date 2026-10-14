import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Icon, ICON_NAMES } from "./Icon";

describe("Icon set", () => {
  it("every named icon renders an svg", () => {
    expect(ICON_NAMES.length).toBeGreaterThan(20);
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector("svg"), `icon "${name}"`).not.toBeNull();
      unmount();
    }
  });
});
