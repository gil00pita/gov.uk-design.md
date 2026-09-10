<script>
  import { onMount, tick } from 'svelte'

  let scope

  onMount(() => {
    let connected = true

    async function initialise() {
      await tick()
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const { initAll } = await import('govuk-frontend')
      if (!connected || !scope?.isConnected) return

      initAll({
        scope,
        onError(error) {
          throw error
        }
      })

      window.__govukSvelteFixtureReady = true
    }

    initialise().catch((error) => {
      console.error(error)
      queueMicrotask(() => {
        throw error
      })
    })

    return () => {
      connected = false
    }
  })
</script>

<div bind:this={scope} data-govuk-svelte-boundary>
  <a class="govuk-skip-link" href="#main-content" data-module="govuk-skip-link">
    Skip to main content
  </a>

  <div class="govuk-width-container">
    <main class="govuk-main-wrapper" id="main-content">
      <h1 class="govuk-heading-xl">GOV.UK Design MD Svelte fixture</h1>

      <section aria-labelledby="svelte-button-heading" class="govuk-!-margin-bottom-9">
        <h2 class="govuk-heading-l" id="svelte-button-heading">Button</h2>
        <button class="govuk-button" data-module="govuk-button" type="submit">
          Save and continue
        </button>
      </section>

      <section aria-labelledby="svelte-text-input-heading" class="govuk-!-margin-bottom-9">
        <h2 class="govuk-heading-l" id="svelte-text-input-heading">Text input</h2>
        <div class="govuk-form-group govuk-form-group--error">
          <label class="govuk-label" for="svelte-national-insurance-number">
            National Insurance number
          </label>
          <div class="govuk-hint" id="svelte-national-insurance-number-hint">
            It is on your National Insurance card, benefit letter, payslip or P60.
          </div>
          <p class="govuk-error-message" id="svelte-national-insurance-number-error">
            <span class="govuk-visually-hidden">Error:</span>
            Enter a National Insurance number in the correct format
          </p>
          <input
            aria-describedby="svelte-national-insurance-number-hint svelte-national-insurance-number-error"
            class="govuk-input govuk-input--width-10 govuk-input--error"
            id="svelte-national-insurance-number"
            name="nationalInsuranceNumber"
            spellcheck="false"
            type="text"
          >
        </div>
      </section>

      <section aria-labelledby="svelte-accordion-heading">
        <h2 class="govuk-heading-l" id="svelte-accordion-heading">Accordion</h2>
        <div
          class="govuk-accordion"
          data-module="govuk-accordion"
          id="svelte-accordion-guidance"
        >
          <div class="govuk-accordion__section">
            <div class="govuk-accordion__section-header">
              <h3 class="govuk-accordion__section-heading">
                <span
                  class="govuk-accordion__section-button"
                  id="svelte-accordion-guidance-heading-1"
                >
                  Writing well for the web
                </span>
              </h3>
            </div>
            <div
              class="govuk-accordion__section-content"
              id="svelte-accordion-guidance-content-1"
            >
              <p class="govuk-body">This is the content for Writing well for the web.</p>
            </div>
          </div>
          <div class="govuk-accordion__section">
            <div class="govuk-accordion__section-header">
              <h3 class="govuk-accordion__section-heading">
                <span
                  class="govuk-accordion__section-button"
                  id="svelte-accordion-guidance-heading-2"
                >
                  Know your audience
                </span>
              </h3>
            </div>
            <div
              class="govuk-accordion__section-content"
              id="svelte-accordion-guidance-content-2"
            >
              <p class="govuk-body">This is the content for Know your audience.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</div>
