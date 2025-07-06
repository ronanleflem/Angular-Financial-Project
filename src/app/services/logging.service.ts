import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  debug(...args: unknown[]): void {
    console.debug(...args);
  }

  info(...args: unknown[]): void {
    console.info(...args);
  }

  error(...args: unknown[]): void {
    console.error(...args);
  }
}
