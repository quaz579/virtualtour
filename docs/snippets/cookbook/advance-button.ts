import { tours } from "virtual-site-tour";

export function wireSaveButton(saveButton: HTMLElement) {
  saveButton.addEventListener("click", () => {
    void tours.current?.forward();
  });
}
