// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HandleField } from "@/components/garderobe/auth/handle-field";

afterEach(cleanup);

describe("HandleField", () => {
  it("shows 'available' for an open handle", () => {
    render(<HandleField value="miamorrow" status="available" />);
    expect(screen.getByText("available")).toBeInTheDocument();
  });

  it("shows a taken message for a claimed handle", () => {
    render(<HandleField value="miamorrow" status="taken" />);
    expect(screen.getByText("already taken, try another")).toBeInTheDocument();
  });

  it("shows neither status while idle", () => {
    render(<HandleField value="" status="idle" />);
    expect(screen.queryByText("available")).not.toBeInTheDocument();
    expect(screen.queryByText("already taken, try another")).not.toBeInTheDocument();
  });
});
