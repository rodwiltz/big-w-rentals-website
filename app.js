(() => {
  "use strict";

  const form = document.querySelector("#funnel");
  const steps = [...document.querySelectorAll(".step")];
  const progress = [...document.querySelectorAll("#progress li")];

  const tables = form.tables;
  const chairs = form.chairs;

  const subtotal = document.querySelector("#subtotal");
  const rentalEstimate = document.querySelector("#rentalEstimate");
  const deliveryEstimate = document.querySelector("#deliveryEstimate");
  const totalEstimate = document.querySelector("#totalEstimate");

  const review = document.querySelector("#review");
  const confirm = document.querySelector("#confirm");
  const submitMsg = document.querySelector("#submitMsg");
  const success = document.querySelector("#success");
  const leadRef = document.querySelector("#leadRef");

  const STORE = "bwrFunnelV2";
  const SUB = "bwrSubmissionId";

  let step = 0;
  let packageSelected = false;
  let busy = false;
  let quoteBusy = false;
  let deliveryQuote = null;

  const attribution = getAttribution();

  restore();
  price();
  show(step);

  document.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!valid(step)) return;

      save();

      if (step === 2) {
        const quoted = await ensureDeliveryQuote(button);
        if (!quoted) return;
      }

      show(Math.min(5, step + 1));
    });
  });

  document.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => {
      save();
      show(Math.max(0, step - 1));
    });
  });

  document.querySelectorAll("[data-for]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.for);
      input.value = Math.max(
        0,
        Math.floor(+input.value + +button.dataset.delta)
      );
      packageSelected = false;
      invalidateDeliveryQuote();
      price();
      save();
    });
  });

  [tables, chairs].forEach((input) => {
    input.addEventListener("input", () => {
      input.value = Math.max(
        0,
        Math.floor(+input.value || 0)
      );
      packageSelected = false;
      invalidateDeliveryQuote();
      price();
      save();
    });
  });

  document.querySelector("#package").addEventListener("click", () => {
    tables.value = 3;
    chairs.value = 20;
    packageSelected = true;
    invalidateDeliveryQuote();
    price();
    save();
  });

  ["address1", "address2", "city", "state", "zipCode"].forEach((name) => {
    form.elements[name].addEventListener("input", () => {
      invalidateDeliveryQuote();
      save();
    });
  });

  form.addEventListener("input", save);
  form.addEventListener("change", save);
  form.addEventListener("submit", submit);
  document.querySelector("#newRequest").addEventListener("click", reset);

  function calc() {
    const t = +tables.value || 0;
    const c = +chairs.value || 0;

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

  function price() {
    const pricing = calc();

    subtotal.textContent =
      money(pricing.s);

    rentalEstimate.textContent =
      money(pricing.s);

    renderEstimate();
  }

  function show(nextStep) {
    step = nextStep;

    steps.forEach((section, index) => {
      section.hidden =
        index !== nextStep;

      section.classList.toggle(
        "active",
        index === nextStep
      );
    });

    progress.forEach((item, index) => {
      item.classList.toggle(
        "active",
        index === nextStep
      );

      item.classList.toggle(
        "done",
        index < nextStep
      );
    });

    if (nextStep === 3) {
      renderEstimate();
    }

    if (nextStep === 5) {
      renderReview();
    }

    scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function valid(currentStep) {
    clearErrors();

    if (currentStep === 0) {
      const pricing = calc();

      if (!pricing.t && !pricing.c) {
        return err(
          "itemsErr",
          "Select at least one table or chair."
        );
      }
    }

    if (currentStep === 1) {
      const startDate =
        form.startDate.value;

      const startTime =
        form.startTime.value;

      const endDate =
        form.endDate.value;

      const endTime =
        form.endTime.value;

      if (
        !startDate ||
        !startTime ||
        !endDate ||
        !endTime
      ) {
        return err(
          "periodErr",
          "Enter the complete rental start and end date/time."
        );
      }

      if (
        !(
          new Date(
            endDate + "T" + endTime
          ) >
          new Date(
            startDate + "T" + startTime
          )
        )
      ) {
        return err(
          "periodErr",
          "The rental end must be after the rental start."
        );
      }
    }

    if (currentStep === 2) {
      if (
        !form.address1.value.trim() ||
        !form.city.value.trim() ||
        !form.state.value.trim() ||
        !/^[0-9]{5}(-[0-9]{4})?$/.test(
          form.zipCode.value.trim()
        )
      ) {
        return err(
          "locationErr",
          "Enter the complete delivery address, including a valid ZIP Code."
        );
      }
    }

    if (currentStep === 3) {
      if (!deliveryQuote) {
        return err(
          "locationErr",
          "Delivery must be calculated before continuing."
        );
      }
    }

    if (currentStep === 4) {
      if (!form.name.value.trim()) {
        return err(
          "contactErr",
          "Enter your name."
        );
      }

      if (!form.mobile.value.trim()) {
        return err(
          "contactErr",
          "Enter the mobile number where Big W should text you."
        );
      }
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
        address.city +
          ", " +
          address.state +
          " " +
          address.zipCode
      ]
        .filter(Boolean)
        .join(", ");

    return address;
  }

  function quoteSignature() {
    const pricing = calc();
    const address = currentAddress();

    return JSON.stringify({
      t: pricing.t,
      c: pricing.c,
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

  function invalidateDeliveryQuote() {
    deliveryQuote = null;
    renderEstimate();
  }

  async function ensureDeliveryQuote(button) {
    const signature =
      quoteSignature();

    if (
      deliveryQuote &&
      deliveryQuote.signature === signature
    ) {
      return true;
    }

    const url =
      window.BWR_CONFIG?.leadApiUrl ||
      "";

    if (
      !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(
        url
      )
    ) {
      return err(
        "locationErr",
        "The delivery calculation service has not been configured yet."
      );
    }

    if (quoteBusy) {
      return false;
    }

    quoteBusy = true;

    const originalText =
      button.textContent;

    button.disabled = true;
    button.textContent =
      "Calculating delivery…";

    try {
      const pricing = calc();

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
                    pricing.t,
                  chairs:
                    pricing.c,
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

      return true;

    } catch (error) {
      deliveryQuote = null;
      renderEstimate();

      return err(
        "locationErr",
        error.message ||
        "We could not calculate delivery for that address. Please check the address and try again."
      );

    } finally {
      quoteBusy = false;
      button.disabled = false;
      button.textContent =
        originalText;
    }
  }

  function renderEstimate() {
    const pricing = calc();

    rentalEstimate.textContent =
      money(pricing.s);

    if (!deliveryQuote) {
      deliveryEstimate.textContent =
        "Not calculated";

      totalEstimate.textContent =
        "Rental + delivery";

      return;
    }

    deliveryEstimate.textContent =
      money(
        deliveryQuote.deliveryAmount
      ) +
      " (" +
      deliveryQuote.distanceMiles
        .toFixed(1) +
      " mi)";

    totalEstimate.textContent =
      money(
        deliveryQuote.estimatedTotal
      );
  }

  function payload() {
    const pricing = calc();
    const address = currentAddress();

    const estimate =
      deliveryQuote
        ? {
            rentalSubtotal:
              pricing.s,

            deliveryDistanceMiles:
              deliveryQuote.distanceMiles,

            deliveryAmount:
              deliveryQuote.deliveryAmount,

            deliveryStatus:
              "CALCULATED",

            estimatedTotal:
              deliveryQuote.estimatedTotal,

            deliveryRatePerMile:
              1.5
          }
        : {
            rentalSubtotal:
              pricing.s,

            deliveryDistanceMiles:
              null,

            deliveryAmount:
              null,

            deliveryStatus:
              "NOT_CALCULATED",

            estimatedTotal:
              null,

            deliveryRatePerMile:
              1.5
          };

    return {
      clientSubmissionId:
        getSub(),

      items: {
        tables:
          pricing.t,
        chairs:
          pricing.c,
        packageSelected:
          packageSelected,
        pricingMode:
          pricing.mode
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
        address,

      estimate:
        estimate,

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

  function renderReview() {
    const data = payload();
    const pricing = calc();

    const items =
      [
        pricing.t
          ? pricing.t +
            " table" +
            (
              pricing.t === 1
                ? ""
                : "s"
            )
          : "",

        pricing.c
          ? pricing.c +
            " chair" +
            (
              pricing.c === 1
                ? ""
                : "s"
            )
          : ""
      ]
        .filter(Boolean)
        .join(" + ");

    const deliveryText =
      deliveryQuote
        ? (
            money(
              deliveryQuote.deliveryAmount
            ) +
            " (" +
            deliveryQuote.distanceMiles
              .toFixed(1) +
            " mi)"
          )
        : "Not calculated";

    const totalText =
      deliveryQuote
        ? money(
            deliveryQuote.estimatedTotal
          )
        : (
            money(pricing.s) +
            " + delivery"
          );

    review.innerHTML =
      `<div>
        <span>
          <small>ITEMS</small>
          ${esc(items)}
        </span>
        <strong>${money(pricing.s)}</strong>
      </div>
      <div>
        <span>
          <small>RENTAL PERIOD</small>
          ${esc(fmt(
            data.rentalPeriod.startDate,
            data.rentalPeriod.startTime
          ))}
          <br>
          to ${esc(fmt(
            data.rentalPeriod.endDate,
            data.rentalPeriod.endTime
          ))}
        </span>
        <strong>${esc(pricing.mode)}</strong>
      </div>
      <div>
        <span>
          <small>DELIVERY</small>
          ${esc(data.deliveryAddress.full)}
        </span>
        <strong>${esc(deliveryText)}</strong>
      </div>
      <div>
        <span>
          <small>ESTIMATED TOTAL</small>
          Rental + delivery
        </span>
        <strong>${esc(totalText)}</strong>
      </div>
      <div>
        <span>
          <small>CONTACT</small>
          ${esc(data.name)}
          <br>
          ${esc(data.mobile)}
        </span>
        <strong>Follow up by text</strong>
      </div>`;
  }

  async function submit(event) {
    event.preventDefault();

    if (
      busy ||
      !valid(4)
    ) {
      return;
    }

    if (!deliveryQuote) {
      return submitErr(
        "Delivery must be calculated before confirming availability."
      );
    }

    const url =
      window.BWR_CONFIG?.leadApiUrl ||
      "";

    if (
      !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(
        url
      )
    ) {
      return submitErr(
        "The lead notification service has not been configured yet."
      );
    }

    setBusy(true);

    try {
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

      form.hidden = true;

      document.querySelector(
        ".progress"
      ).hidden = true;

      document.querySelector(
        ".intro"
      ).hidden = true;

      leadRef.textContent =
        result.leadId ||
        "Received";

      success.hidden = false;

      scrollTo({
        top: 0,
        behavior: "smooth"
      });

    } catch (error) {
      submitErr(
        error.message ||
        "Your request could not be sent. Please try again."
      );

    } finally {
      setBusy(false);
    }
  }

  function save() {
    const values = {};

    new FormData(form).forEach(
      (value, key) => {
        values[key] = value;
      }
    );

    sessionStorage.setItem(
      STORE,
      JSON.stringify({
        step,
        packageSelected,
        values,
        tables:
          +tables.value || 0,
        chairs:
          +chairs.value || 0,
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

      step =
        Math.max(
          0,
          Math.min(
            5,
            +saved.step || 0
          )
        );

      packageSelected =
        Boolean(
          saved.packageSelected ??
          saved.pkg
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
        saved.deliveryQuote ||
        null;

      if (
        deliveryQuote &&
        deliveryQuote.signature !==
          quoteSignature()
      ) {
        deliveryQuote = null;
      }

    } catch (_) {
      deliveryQuote = null;
    }
  }

  function reset() {
    form.reset();
    form.state.value = "TX";
    tables.value = 0;
    chairs.value = 0;
    packageSelected = false;
    deliveryQuote = null;

    sessionStorage.removeItem(
      STORE
    );

    sessionStorage.removeItem(
      SUB
    );

    success.hidden = true;
    form.hidden = false;

    document.querySelector(
      ".progress"
    ).hidden = false;

    document.querySelector(
      ".intro"
    ).hidden = false;

    price();
    show(0);
  }

  function getSub() {
    let id =
      sessionStorage.getItem(
        SUB
      );

    if (!id) {
      id =
        crypto.randomUUID
          ? crypto.randomUUID()
          : (
              Date.now() +
              "-" +
              Math.random()
            );

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
      document.referrer ||
      "";

    let source =
      query.get("utm_source") ||
      "";

    if (!source) {
      source =
        /google\./i.test(
          referrer
        )
          ? "Google"
          : /facebook\.|fb\./i.test(
              referrer
            )
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

  function fmt(date, time) {
    return new Date(
      date +
      "T" +
      time +
      ":00"
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
      (+value).toFixed(2)
    );
  }

  function esc(value) {
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

  function clearErrors() {
    [
      "itemsErr",
      "periodErr",
      "locationErr",
      "contactErr"
    ].forEach((id) => {
      const element =
        document.getElementById(
          id
        );

      element.hidden = true;
      element.textContent = "";
    });

    submitMsg.hidden = true;
  }

  function err(id, text) {
    const element =
      document.getElementById(id);

    element.textContent = text;
    element.hidden = false;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    return false;
  }

  function submitErr(text) {
    submitMsg.textContent = text;
    submitMsg.hidden = false;

    submitMsg.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function setBusy(value) {
    busy = value;
    confirm.disabled = value;
    confirm.querySelector(
      ".ready"
    ).hidden = value;
    confirm.querySelector(
      ".working"
    ).hidden = !value;
  }
})();
