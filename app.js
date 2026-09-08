(() => {
  "use strict";

  const form = document.querySelector("#rentalBuilder");
  if (!form) return;

  const STORE = "bwrStorefrontV2";
  const SUB = "bwrSubmissionId";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const tables = form.elements.tables;
  const chairs = form.elements.chairs;
  const cardTables = $("#cardTables");
  const cardChairs = $("#cardChairs");

  const subtotal = $("#subtotal");
  const delivery = $("#delivery");
  const total = $("#total");
  const catalogSubtotal = $("#catalogSubtotal");

  const review = $("#review");
  const reviewDetails = $("#reviewDetails");
  const confirm = $("#confirm");
  const success = $("#success");
  const leadRef = $("#leadRef");

  let packageSelected = false;
  let deliveryQuote = null;
  let quoteBusy = false;
  let sending = false;

  const attribution = getAttribution();

  restore();
  syncCardControls();
  updateAll();

  $("#menu")?.addEventListener("click", () => {
    const nav = $("#nav");
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    $("#menu").setAttribute("aria-expanded", String(open));
  });

  // Header/hero/pricing CTAs now take the customer to Stage 1: storefront cards.
  $$("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#nav")?.classList.remove("open");
      $("#rentals").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  $$("[data-card-qty]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.cardQty;
      const input = name === "tables" ? cardTables : cardChairs;
      input.value = Math.max(
        0,
        Math.floor((Number(input.value) || 0) + Number(button.dataset.delta))
      );

      packageSelected = false;
      syncRentalStateFromCards();
    });
  });

  [cardTables, cardChairs].forEach((input) => {
    input.addEventListener("input", () => {
      input.value = Math.max(0, Math.floor(Number(input.value) || 0));
      packageSelected = false;
      syncRentalStateFromCards();
    });
  });

  $("[data-card-package]")?.addEventListener("click", () => {
    cardTables.value = 3;
    cardChairs.value = 20;
    packageSelected = true;
    syncRentalStateFromCards();
    $("#packageStatus").hidden = false;
  });

  $("#continueFromCatalog")?.addEventListener("click", () => {
    clearError("catalogError");

    if (!validateItems()) {
      $("#catalogError").textContent = "Choose at least one table or chair.";
      $("#catalogError").hidden = false;
      return;
    }

    openStep("when");
    $("#builder").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  ["address1", "address2", "city", "state", "zipCode"].forEach((name) => {
    form.elements[name].addEventListener("input", () => {
      invalidateDeliveryQuote();
      updateAll();
    });
  });

  form.addEventListener("input", () => {
    renderSummaries();
    save();
  });

  form.addEventListener("change", () => {
    renderSummaries();
    save();
  });

  $$("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => openStep(button.dataset.toggle));
  });

  $$("[data-back]").forEach((button) => {
    button.addEventListener("click", () => openStep(button.dataset.back));
  });

  $("[data-back-catalog]")?.addEventListener("click", () => {
    $("#rentals").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $$("[data-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.next;

      if (next === "where" && !validateWhen()) return;

      openStep(next);
    });
  });

  $("#calcDelivery").addEventListener("click", calculateDelivery);
  $("#reviewBtn").addEventListener("click", prepareReview);
  $("#again").addEventListener("click", reset);
  form.addEventListener("submit", submit);

  function pricing() {
    const t = Number(tables.value) || 0;
    const c = Number(chairs.value) || 0;

    if (
      packageSelected &&
      t === 3 &&
      c === 20
    ) {
      return {
        t,
        c,
        s: 50,
        mode: "3 Tables + 20 Chairs package"
      };
    }

    const bulk =
      t >= 3 &&
      c >= 20;

    return {
      t,
      c,
      s:
        t * (bulk ? 6 : 8) +
        c * (bulk ? 1.5 : 2),
      mode:
        bulk
          ? "Bulk pricing"
          : "Standard pricing"
    };
  }

  function syncRentalStateFromCards() {
    tables.value = Number(cardTables.value) || 0;
    chairs.value = Number(cardChairs.value) || 0;

    if (!(packageSelected && Number(tables.value) === 3 && Number(chairs.value) === 20)) {
      $("#packageStatus").hidden = true;
    }

    invalidateDeliveryQuote();
    updateAll();
  }

  function syncCardControls() {
    cardTables.value = Number(tables.value) || 0;
    cardChairs.value = Number(chairs.value) || 0;
    $("#packageStatus").hidden = !(packageSelected && Number(tables.value) === 3 && Number(chairs.value) === 20);
  }

  function invalidateDeliveryQuote() {
    deliveryQuote = null;
    review.hidden = true;
    renderEstimate();
  }

  function updateAll() {
    renderEstimate();
    renderSummaries();
    save();
  }

  function renderEstimate() {
    const p = pricing();

    subtotal.textContent = money(p.s);
    catalogSubtotal.textContent = money(p.s);

    if (!deliveryQuote) {
      delivery.textContent = "—";
      total.textContent = money(p.s);
      return;
    }

    // Accepted EWO-BWR-003R1 customer presentation:
    // amount only; no mileage and no per-mile rate.
    delivery.textContent =
      money(deliveryQuote.deliveryAmount);

    total.textContent =
      money(deliveryQuote.estimatedTotal);
  }

  function renderSummaries() {
    if (
      form.startDate.value &&
      form.startTime.value &&
      form.endDate.value &&
      form.endTime.value
    ) {
      setSummary(
        "when",
        `${formatDateTime(form.startDate.value, form.startTime.value)} → ${formatDateTime(form.endDate.value, form.endTime.value)}`
      );
    } else {
      setSummary("when", "Rental start and return timing.");
    }

    const a = currentAddress();

    setSummary(
      "where",
      a.address1 && a.city && a.zipCode
        ? a.full
        : "Enter the delivery address."
    );

    setSummary(
      "contact",
      form.name.value.trim() && form.mobile.value.trim()
        ? `${form.name.value.trim()} · ${form.mobile.value.trim()}`
        : "Big W will follow up by text."
    );
  }

  function setSummary(name, value) {
    const element = $(`[data-summary="${name}"]`);
    if (element) element.textContent = value;
  }

  function openStep(name) {
    $$("[data-step]").forEach((section) => {
      const active = section.dataset.step === name;
      section.classList.toggle("open", active);
      section.querySelector(".content").hidden = !active;
    });

    $(`[data-step="${name}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function validateItems() {
    const p = pricing();
    return Boolean(p.t || p.c);
  }

  function validateWhen() {
    clearError("whenError");

    const startDate = form.startDate.value;
    const startTime = form.startTime.value;
    const endDate = form.endDate.value;
    const endTime = form.endTime.value;

    if (!startDate || !startTime || !endDate || !endTime) {
      return showError(
        "whenError",
        "Enter the complete rental start and end date/time."
      );
    }

    if (
      !(
        new Date(`${endDate}T${endTime}`) >
        new Date(`${startDate}T${startTime}`)
      )
    ) {
      return showError(
        "whenError",
        "The rental end must be after the rental start."
      );
    }

    return true;
  }

  function validateWhere() {
    clearError("whereError");

    if (
      !form.address1.value.trim() ||
      !form.city.value.trim() ||
      !form.state.value.trim() ||
      !/^\d{5}(?:-\d{4})?$/.test(
        form.zipCode.value.trim()
      )
    ) {
      return showError(
        "whereError",
        "Enter the complete delivery address, including a valid ZIP code."
      );
    }

    return true;
  }

  function validateContact() {
    clearError("contactError");

    if (!form.name.value.trim()) {
      return showError(
        "contactError",
        "Enter your name."
      );
    }

    if (!form.mobile.value.trim()) {
      return showError(
        "contactError",
        "Enter the mobile number where Big W should text you."
      );
    }

    return true;
  }

  function currentAddress() {
    const address = {
      address1:
        form.address1.value.trim(),

      address2:
        form.address2.value.trim(),

      city:
        form.city.value.trim(),

      state:
        form.state.value
          .trim()
          .toUpperCase(),

      zipCode:
        form.zipCode.value.trim()
    };

    address.full =
      [
        address.address1,
        address.address2,
        address.city
          ? `${address.city}, ${address.state} ${address.zipCode}`
          : ""
      ]
        .filter(Boolean)
        .join(", ");

    return address;
  }

  function quoteSignature() {
    const p = pricing();
    const address = currentAddress();

    return JSON.stringify({
      t: p.t,
      c: p.c,
      packageSelected:
        packageSelected,
      address1:
        address.address1,
      address2:
        address.address2,
      city:
        address.city,
      state:
        address.state,
      zipCode:
        address.zipCode
    });
  }

  /*
   * DELIVERY RESTORATION
   *
   * This request/response sequence is intentionally restored from the
   * accepted EWO-BWR-003R1 implementation rather than redesigned.
   */
  async function calculateDelivery() {
    if (
      !validateItems() ||
      !validateWhen() ||
      !validateWhere()
    ) {
      return;
    }

    const signature =
      quoteSignature();

    if (
      deliveryQuote &&
      deliveryQuote.signature === signature
    ) {
      openStep("contact");
      return;
    }

    const url =
      window.BWR_CONFIG?.leadApiUrl ||
      "";

    if (
      !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(
        url
      )
    ) {
      return showError(
        "whereError",
        "The delivery calculation service has not been configured yet."
      );
    }

    if (quoteBusy) {
      return;
    }

    quoteBusy = true;

    const button =
      $("#calcDelivery");

    const originalText =
      button.textContent;

    button.disabled =
      true;

    button.textContent =
      "Calculating delivery…";

    clearError("whereError");

    try {
      const p =
        pricing();

      const response =
        await fetch(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "text/plain;charset=utf-8"
            },
            body:
              JSON.stringify({
                action:
                  "CALCULATE_DELIVERY",

                items: {
                  tables:
                    p.t,

                  chairs:
                    p.c,

                  packageSelected:
                    packageSelected
                },

                deliveryAddress:
                  currentAddress()
              }),
            redirect:
              "follow"
          }
        );

      const result =
        await response.json();

      if (!result.ok) {
        throw new Error(
          result.message ||
          "Delivery could not be calculated."
        );
      }

      deliveryQuote = {
        signature:
          signature,

        distanceMiles:
          Number(
            result.distanceMiles
          ),

        deliveryRatePerMile:
          Number(
            result.deliveryRatePerMile
          ),

        deliveryAmount:
          Number(
            result.deliveryAmount
          ),

        rentalSubtotal:
          Number(
            result.rentalSubtotal
          ),

        estimatedTotal:
          Number(
            result.estimatedTotal
          ),

        deliveryStatus:
          "CALCULATED"
      };

      renderEstimate();
      save();
      openStep("contact");

    } catch (error) {
      deliveryQuote =
        null;

      renderEstimate();

      showError(
        "whereError",
        error.message ||
        "We could not calculate delivery for that address. Please check the address and try again."
      );

    } finally {
      quoteBusy =
        false;

      button.disabled =
        false;

      button.textContent =
        originalText;
    }
  }

  function prepareReview() {
    if (
      !validateItems() ||
      !validateWhen() ||
      !validateWhere()
    ) {
      return;
    }

    if (
      !deliveryQuote ||
      deliveryQuote.signature !==
        quoteSignature()
    ) {
      showError(
        "whereError",
        "Delivery needs to be recalculated for this address."
      );

      openStep("where");
      return;
    }

    if (!validateContact()) {
      return;
    }

    renderReview();
    review.hidden =
      false;

    review.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function renderReview() {
    const p =
      pricing();

    const a =
      currentAddress();

    const items =
      [
        p.t
          ? `${p.t} table${p.t === 1 ? "" : "s"}`
          : "",

        p.c
          ? `${p.c} chair${p.c === 1 ? "" : "s"}`
          : ""
      ]
        .filter(Boolean)
        .join(" + ");

    reviewDetails.innerHTML =
      line(
        "Rental",
        `${escapeHtml(items)} · ${money(p.s)}`
      ) +
      line(
        "When",
        `${escapeHtml(formatDateTime(form.startDate.value, form.startTime.value))}<br>to ${escapeHtml(formatDateTime(form.endDate.value, form.endTime.value))}`
      ) +
      line(
        "Delivery",
        `${escapeHtml(a.full)}<br>${money(deliveryQuote.deliveryAmount)}`
      ) +
      line(
        "Estimated total",
        money(deliveryQuote.estimatedTotal)
      ) +
      line(
        "Contact",
        `${escapeHtml(form.name.value.trim())}<br>${escapeHtml(form.mobile.value.trim())}`
      );
  }

  function line(label, value) {
    return `<div class="reviewline"><span>${label}</span><b>${value}</b></div>`;
  }

  function payload() {
    const p =
      pricing();

    return {
      clientSubmissionId:
        getSubmissionId(),

      items: {
        tables:
          p.t,

        chairs:
          p.c,

        packageSelected:
          packageSelected,

        pricingMode:
          p.mode
      },

      rentalPeriod: {
        startDate:
          form.startDate.value,

        startTime:
          form.startTime.value,

        endDate:
          form.endDate.value,

        endTime:
          form.endTime.value
      },

      deliveryAddress:
        currentAddress(),

      estimate: {
        rentalSubtotal:
          p.s,

        deliveryDistanceMiles:
          deliveryQuote
            ? deliveryQuote.distanceMiles
            : null,

        deliveryAmount:
          deliveryQuote
            ? deliveryQuote.deliveryAmount
            : null,

        deliveryStatus:
          deliveryQuote
            ? "CALCULATED"
            : "NOT_CALCULATED",

        estimatedTotal:
          deliveryQuote
            ? deliveryQuote.estimatedTotal
            : null,

        deliveryRatePerMile:
          deliveryQuote
            ? deliveryQuote.deliveryRatePerMile
            : 1.5
      },

      name:
        form.name.value.trim(),

      mobile:
        form.mobile.value.trim(),

      notes:
        form.notes.value.trim(),

      attribution:
        attribution
    };
  }

  async function submit(event) {
    event.preventDefault();

    if (
      sending ||
      !validateContact()
    ) {
      return;
    }

    if (
      !deliveryQuote ||
      deliveryQuote.signature !==
        quoteSignature()
    ) {
      showError(
        "whereError",
        "Delivery needs to be recalculated before confirming availability."
      );

      openStep("where");
      return;
    }

    $("#submitError").hidden =
      true;

    setSending(true);

    try {
      const url =
        window.BWR_CONFIG?.leadApiUrl ||
        "";

      if (
        !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(
          url
        )
      ) {
        throw new Error(
          "The Big W Rentals request service is not configured."
        );
      }

      const response =
        await fetch(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "text/plain;charset=utf-8"
            },
            body:
              JSON.stringify(
                payload()
              ),
            redirect:
              "follow"
          }
        );

      const result =
        await response.json();

      if (!result.ok) {
        throw new Error(
          result.message ||
          "Your request could not be sent."
        );
      }

      sessionStorage.removeItem(
        STORE
      );

      sessionStorage.removeItem(
        SUB
      );

      form.hidden =
        true;

      $(".builderintro").hidden =
        true;

      success.hidden =
        false;

      leadRef.textContent =
        result.leadId ||
        "Received";

      success.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    } catch (error) {
      const element =
        $("#submitError");

      element.textContent =
        error.message ||
        "Your request could not be sent. Please try again.";

      element.hidden =
        false;

    } finally {
      setSending(false);
    }
  }

  function save() {
    const values =
      {};

    new FormData(form).forEach(
      (value, key) => {
        values[key] =
          value;
      }
    );

    sessionStorage.setItem(
      STORE,
      JSON.stringify({
        packageSelected,
        values,
        tables:
          Number(tables.value) || 0,
        chairs:
          Number(chairs.value) || 0,
        deliveryQuote
      })
    );
  }

  function restore() {
    try {
      const saved =
        JSON.parse(
          sessionStorage.getItem(
            STORE
          ) || "null"
        );

      if (!saved) {
        return;
      }

      packageSelected =
        Boolean(
          saved.packageSelected
        );

      Object.entries(
        saved.values || {}
      ).forEach(
        ([key, value]) => {
          if (form.elements[key]) {
            form.elements[key].value =
              value;
          }
        }
      );

      tables.value =
        saved.tables || 0;

      chairs.value =
        saved.chairs || 0;

      deliveryQuote =
        saved.deliveryQuote || null;

      if (
        deliveryQuote &&
        deliveryQuote.signature !==
          quoteSignature()
      ) {
        deliveryQuote =
          null;
      }

    } catch (_) {
      deliveryQuote =
        null;
    }
  }

  function reset() {
    form.reset();

    form.state.value =
      "TX";

    tables.value =
      0;

    chairs.value =
      0;

    cardTables.value =
      0;

    cardChairs.value =
      0;

    packageSelected =
      false;

    deliveryQuote =
      null;

    sessionStorage.removeItem(
      STORE
    );

    sessionStorage.removeItem(
      SUB
    );

    $(".builderintro").hidden =
      false;

    form.hidden =
      false;

    success.hidden =
      true;

    review.hidden =
      true;

    $("#packageStatus").hidden =
      true;

    updateAll();

    $("#rentals").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function getSubmissionId() {
    let id =
      sessionStorage.getItem(
        SUB
      );

    if (!id) {
      id =
        crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      sessionStorage.setItem(
        SUB,
        id
      );
    }

    return id;
  }

  function getAttribution() {
    const query =
      new URLSearchParams(
        location.search
      );

    const referrer =
      document.referrer || "";

    let source =
      query.get("utm_source") || "";

    if (!source) {
      source =
        /google\./i.test(referrer)
          ? "Google"
          : /facebook\.|fb\./i.test(referrer)
            ? "Facebook"
            : referrer
              ? "Referral"
              : "Direct";
    }

    return {
      leadSource:
        source,

      sourceDetail:
        query.get(
          "source_detail"
        ) || "",

      landingPage:
        location.href,

      referrer:
        referrer,

      utmSource:
        query.get(
          "utm_source"
        ) || "",

      utmMedium:
        query.get(
          "utm_medium"
        ) || "",

      utmCampaign:
        query.get(
          "utm_campaign"
        ) || "",

      utmContent:
        query.get(
          "utm_content"
        ) || "",

      utmTerm:
        query.get(
          "utm_term"
        ) || ""
    };
  }

  function formatDateTime(date, time) {
    return new Date(
      `${date}T${time}:00`
    ).toLocaleString(
      [],
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    );
  }

  function money(value) {
    return (
      "$" +
      Number(value || 0).toFixed(2)
    );
  }

  function escapeHtml(value) {
    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[character]
    );
  }

  function showError(id, text) {
    const element =
      $("#" + id);

    element.textContent =
      text;

    element.hidden =
      false;

    element.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });

    return false;
  }

  function clearError(id) {
    const element =
      $("#" + id);

    if (!element) {
      return;
    }

    element.hidden =
      true;

    element.textContent =
      "";
  }

  function setSending(value) {
    sending =
      value;

    confirm.disabled =
      value;

    const labels =
      confirm.querySelectorAll(
        "span"
      );

    labels[0].hidden =
      value;

    labels[1].hidden =
      !value;
  }
})();
