// RolePebble's landing page: the step counter, and the waitlist forms
// without a page reload. The page works without this file: the forms post
// to /api/waitlist and get a page back.

// The counter next to the steps shows the step whose card is on top.
const steps = document.querySelector("[data-steps]");
if (steps) {
  const cards = [...steps.querySelectorAll("[data-step]")];
  const current = steps.querySelector("[data-step-current]");
  let shown = 1;
  let queued = false;

  const update = () => {
    queued = false;
    let active = 1;
    for (const card of cards) {
      // A card is on top once it has reached the place it sticks at.
      const stickAt = parseFloat(getComputedStyle(card).top) || 0;
      if (card.getBoundingClientRect().top <= stickAt + 2) active = Number(card.dataset.step);
    }
    steps.style.setProperty("--progress", `${(active / cards.length) * 100}%`);
    if (active !== shown) {
      shown = active;
      current.textContent = String(active);
      current.classList.remove("flip");
      void current.offsetWidth; // restart the animation
      current.classList.add("flip");
    }
  };

  addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

// Where the visitor came from, from links like /?ref=instagram. Kept for the
// visit, so it still counts if they join after moving around the page.
let ref = new URLSearchParams(location.search).get("ref");
try {
  if (ref) sessionStorage.setItem("ref", ref);
  else ref = sessionStorage.getItem("ref");
} catch {
  // Storage can be off (private windows); the tag then counts only on this page.
}

for (const form of document.querySelectorAll("[data-waitlist]")) {
  const note = form.querySelector(".form-note");
  const button = form.querySelector("button");

  // Sent back here by a form posted without this script.
  if (form.closest("#join") && new URLSearchParams(location.search).has("invalid")) {
    note.dataset.state = "error";
    note.textContent = "Please enter a valid email address.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    note.removeAttribute("data-state");
    note.textContent = "Adding you…";
    try {
      const body = new FormData(form);
      if (ref) body.set("ref", ref);
      const response = await fetch(form.action, {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error);
      note.dataset.state = "ok";
      note.textContent = "You're on the list. We'll email you when the beta opens.";
      form.reset();
    } catch (error) {
      note.dataset.state = "error";
      note.textContent =
        error instanceof Error && error.message
          ? error.message
          : "That didn't work. Please try again in a moment.";
    } finally {
      button.disabled = false;
    }
  });
}
