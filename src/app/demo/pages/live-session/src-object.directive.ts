import { Directive, ElementRef, Input, inject } from '@angular/core';

/**
 * Directive that allows binding a MediaStream to a <video> element's srcObject property.
 * Usage: <video [appSrcObject]="myMediaStream" autoplay playsinline></video>
 */
@Directive({
  selector: '[appSrcObject]',
  standalone: true
})
export class SrcObjectDirective {
  private elementRef = inject(ElementRef);
  private _stream: MediaStream | null = null;

  @Input() set appSrcObject(stream: MediaStream | null) {
    const el = this.elementRef.nativeElement as HTMLVideoElement;
    if (this._stream !== stream) {
      if (this._stream) {
        this._stream.onaddtrack = null;
        this._stream.onremovetrack = null;
      }
      this._stream = stream;
      el.srcObject = stream;
      
      if (stream) {
        stream.onaddtrack = () => {
          el.srcObject = stream;
          el.play().catch(() => {});
        };
        stream.onremovetrack = () => {
          el.srcObject = stream;
          el.play().catch(() => {});
        };
        el.play().catch(() => {});
      }
    }
  }
}

