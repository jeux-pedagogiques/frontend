import { Directive, ElementRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';

/**
 * Directive that binds a MediaStream to a <video> element's srcObject property.
 * Usage: <video [appSrcObject]="myMediaStream" autoplay playsinline></video>
 */
@Directive({
  selector: '[appSrcObject]',
  standalone: true
})
export class SrcObjectDirective implements OnChanges {
  private elementRef = inject(ElementRef);
  @Input('appSrcObject') stream: MediaStream | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    const el = this.elementRef.nativeElement as HTMLVideoElement;
    if (!el) return;

    if (el.srcObject !== this.stream) {
      el.srcObject = this.stream;
    }

    if (this.stream) {
      this.stream.onaddtrack = () => {
        if (el.srcObject !== this.stream) {
          el.srcObject = this.stream;
        }
        el.play().catch(() => {});
      };
      this.stream.onremovetrack = () => {
        el.play().catch(() => {});
      };
      // Try playing immediately
      el.play().catch(() => {});
    }
  }
}


