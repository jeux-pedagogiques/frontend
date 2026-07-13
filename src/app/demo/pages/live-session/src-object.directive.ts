import { Directive, ElementRef, Input } from '@angular/core';

/**
 * Directive that allows binding a MediaStream to a <video> element's srcObject property.
 * Usage: <video [appSrcObject]="myMediaStream" autoplay playsinline></video>
 */
@Directive({
  selector: '[appSrcObject]',
  standalone: true
})
export class SrcObjectDirective {
  @Input() set appSrcObject(stream: MediaStream | null) {
    const el = this.elementRef.nativeElement as HTMLVideoElement;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }

  constructor(private elementRef: ElementRef) {}
}
