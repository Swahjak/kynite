import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteConfirmationDialog } from "../delete-confirmation-dialog";

describe("DeleteConfirmationDialog", () => {
  it("renders with title and description", () => {
    render(
      <DeleteConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete Calendar"
        description="This will delete the calendar."
        confirmText="My Calendar"
        onConfirm={() => {}}
      />
    );

    expect(screen.getByText("Delete Calendar")).toBeInTheDocument();
    expect(
      screen.getByText("This will delete the calendar.")
    ).toBeInTheDocument();
  });

  it("disables confirm button until text matches", async () => {
    const user = userEvent.setup();
    render(
      <DeleteConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete"
        description="Confirm deletion"
        confirmText="My Calendar"
        onConfirm={() => {}}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /delete/i });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByPlaceholderText(/type "My Calendar"/i);
    await user.type(input, "My Calendar");

    expect(confirmButton).toBeEnabled();
  });

  it("calls onConfirm when text matches and button clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DeleteConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete"
        description="Confirm deletion"
        confirmText="TestName"
        onConfirm={onConfirm}
      />
    );

    const input = screen.getByPlaceholderText(/type "TestName"/i);
    await user.type(input, "TestName");

    const confirmButton = screen.getByRole("button", { name: /delete/i });
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows loading state when isDeleting is true", () => {
    render(
      <DeleteConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete"
        description="Confirm deletion"
        confirmText="Test"
        onConfirm={() => {}}
        isDeleting={true}
      />
    );

    expect(screen.getByText(/deleting/i)).toBeInTheDocument();
  });
});
