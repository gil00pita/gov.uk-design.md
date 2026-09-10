import '@angular/compiler'
import { ChangeDetectionStrategy, Component } from '@angular/core'

export const fixtureTemplate = `
  <div class="govuk-width-container">
    <main class="govuk-main-wrapper" id="main-content">
      <h1 class="govuk-heading-xl">GOV.UK Design MD Angular fixture</h1>

      <section aria-labelledby="angular-button-heading" class="govuk-!-margin-bottom-9">
        <h2 class="govuk-heading-l" id="angular-button-heading">Button</h2>
        <button class="govuk-button" data-module="govuk-button" type="submit">
          Save and continue
        </button>
      </section>

      <section aria-labelledby="angular-text-input-heading" class="govuk-!-margin-bottom-9">
        <h2 class="govuk-heading-l" id="angular-text-input-heading">Text input</h2>
        <div class="govuk-form-group govuk-form-group--error">
          <label class="govuk-label" for="angular-national-insurance-number">
            National Insurance number
          </label>
          <div class="govuk-hint" id="angular-national-insurance-number-hint">
            It is on your National Insurance card, benefit letter, payslip or P60.
          </div>
          <p class="govuk-error-message" id="angular-national-insurance-number-error">
            <span class="govuk-visually-hidden">Error:</span>
            Enter a National Insurance number in the correct format
          </p>
          <input
            aria-describedby="angular-national-insurance-number-hint angular-national-insurance-number-error"
            class="govuk-input govuk-input--width-10 govuk-input--error"
            id="angular-national-insurance-number"
            name="nationalInsuranceNumber"
            spellcheck="false"
            type="text"
          >
        </div>
      </section>

      <section aria-labelledby="angular-accordion-heading">
        <h2 class="govuk-heading-l" id="angular-accordion-heading">Accordion</h2>
        <div
          class="govuk-accordion"
          data-module="govuk-accordion"
          id="angular-accordion-guidance"
        >
          <div class="govuk-accordion__section">
            <div class="govuk-accordion__section-header">
              <h3 class="govuk-accordion__section-heading">
                <span
                  class="govuk-accordion__section-button"
                  id="angular-accordion-guidance-heading-1"
                >
                  Writing well for the web
                </span>
              </h3>
            </div>
            <div
              class="govuk-accordion__section-content"
              id="angular-accordion-guidance-content-1"
            >
              <p class="govuk-body">This is the content for Writing well for the web.</p>
            </div>
          </div>
          <div class="govuk-accordion__section">
            <div class="govuk-accordion__section-header">
              <h3 class="govuk-accordion__section-heading">
                <span
                  class="govuk-accordion__section-button"
                  id="angular-accordion-guidance-heading-2"
                >
                  Know your audience
                </span>
              </h3>
            </div>
            <div
              class="govuk-accordion__section-content"
              id="angular-accordion-guidance-content-2"
            >
              <p class="govuk-body">This is the content for Know your audience.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
`

export class GovukFixtureComponent {}

Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'govuk-fixture',
  standalone: true,
  template: fixtureTemplate
})(GovukFixtureComponent)
