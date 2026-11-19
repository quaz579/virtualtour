import { tours } from "virtualtour";

export function wireSaveButton(saveButton: HTMLElement) {
  saveButton.addEventListener("click", () => {
    void tours.current?.forward();
  });
}
