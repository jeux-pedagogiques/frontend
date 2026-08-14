/// <reference types="@angular/localize" />

import { enableProdMode, importProvidersFrom, APP_INITIALIZER, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { environment } from './environments/environment';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { jwtInterceptor } from './app/theme/shared/interceptor/jwt.interceptor';
import { FontSizeService } from './app/theme/shared/service/font-size.service';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule, AppRoutingModule),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        // Eagerly instantiate FontSizeService so it applies the persisted
        // --base-font-size before the first paint.
        inject(FontSizeService);
        return () => {};
      },
      multi: true
    }
  ]
}).catch((err) => console.error(err));
