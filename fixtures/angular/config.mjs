import { provideClientHydration, withNoIncrementalHydration } from '@angular/platform-browser'

export const appConfig = {
  providers: [provideClientHydration(withNoIncrementalHydration())]
}
