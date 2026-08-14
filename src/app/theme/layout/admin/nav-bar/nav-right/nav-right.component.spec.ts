import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavRightComponent } from './nav-right.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';

describe('NavRightComponent - Fullscreen Challenger Tests', () => {
  let component: NavRightComponent;
  let fixture: ComponentFixture<NavRightComponent>;

  let realExitFullscreen: any;
  let realRequestFullscreen: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavRightComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        provideNoopAnimations()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NavRightComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    realExitFullscreen = document.exitFullscreen;
    realRequestFullscreen = document.documentElement.requestFullscreen;
  });

  afterEach(() => {
    if (realExitFullscreen) {
      document.exitFullscreen = realExitFullscreen;
    }
    if (realRequestFullscreen) {
      document.documentElement.requestFullscreen = realRequestFullscreen;
    }
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('1. Standard HTML5 & Vendor Prefix Fullscreen Support', () => {
    it('should invoke standard requestFullscreen when no element is in fullscreen', () => {
      const requestSpy = jasmine.createSpy('requestFullscreen').and.returnValue(Promise.resolve());
      document.documentElement.requestFullscreen = requestSpy;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      component.toggleFullscreen();

      expect(requestSpy).toHaveBeenCalled();
    });

    it('should invoke standard exitFullscreen when an element is in fullscreen', () => {
      const exitSpy = jasmine.createSpy('exitFullscreen').and.returnValue(Promise.resolve());
      document.exitFullscreen = exitSpy;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(document.documentElement);

      component.toggleFullscreen();

      expect(exitSpy).toHaveBeenCalled();
    });

    it('should invoke webkitRequestFullscreen when webkit vendor prefix is present and standard is unavailable', () => {
      delete (document.documentElement as any).requestFullscreen;
      const webkitRequestSpy = jasmine.createSpy('webkitRequestFullscreen');
      (document.documentElement as any).webkitRequestFullscreen = webkitRequestSpy;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      component.toggleFullscreen();

      expect(webkitRequestSpy).toHaveBeenCalled();
      delete (document.documentElement as any).webkitRequestFullscreen;
    });

    it('should invoke webkitExitFullscreen when webkit fullscreen element exists and standard exit is unavailable', () => {
      delete (document as any).exitFullscreen;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);
      Object.defineProperty(document, 'webkitFullscreenElement', {
        value: document.documentElement,
        configurable: true,
        writable: true
      });
      const webkitExitSpy = jasmine.createSpy('webkitExitFullscreen');
      (document as any).webkitExitFullscreen = webkitExitSpy;

      component.toggleFullscreen();

      expect(webkitExitSpy).toHaveBeenCalled();
      delete (document as any).webkitFullscreenElement;
      delete (document as any).webkitExitFullscreen;
    });

    it('should invoke mozRequestFullScreen when moz vendor prefix is present and standard is unavailable', () => {
      delete (document.documentElement as any).requestFullscreen;
      delete (document.documentElement as any).webkitRequestFullscreen;
      const mozRequestSpy = jasmine.createSpy('mozRequestFullScreen');
      (document.documentElement as any).mozRequestFullScreen = mozRequestSpy;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      component.toggleFullscreen();

      expect(mozRequestSpy).toHaveBeenCalled();
      delete (document.documentElement as any).mozRequestFullScreen;
    });

    it('should invoke mozCancelFullScreen when moz fullscreen element exists and standard exit is unavailable', () => {
      delete (document as any).exitFullscreen;
      delete (document as any).webkitExitFullscreen;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);
      Object.defineProperty(document, 'mozFullScreenElement', {
        value: document.documentElement,
        configurable: true,
        writable: true
      });
      const mozExitSpy = jasmine.createSpy('mozCancelFullScreen');
      (document as any).mozCancelFullScreen = mozExitSpy;

      component.toggleFullscreen();

      expect(mozExitSpy).toHaveBeenCalled();
      delete (document as any).mozFullScreenElement;
      delete (document as any).mozCancelFullScreen;
    });

    it('should invoke msRequestFullscreen when ms vendor prefix is present and standard is unavailable', () => {
      delete (document.documentElement as any).requestFullscreen;
      delete (document.documentElement as any).webkitRequestFullscreen;
      delete (document.documentElement as any).mozRequestFullScreen;
      const msRequestSpy = jasmine.createSpy('msRequestFullscreen');
      (document.documentElement as any).msRequestFullscreen = msRequestSpy;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      component.toggleFullscreen();

      expect(msRequestSpy).toHaveBeenCalled();
      delete (document.documentElement as any).msRequestFullscreen;
    });

    it('should invoke msExitFullscreen when ms fullscreen element exists and standard exit is unavailable', () => {
      delete (document as any).exitFullscreen;
      delete (document as any).webkitExitFullscreen;
      delete (document as any).mozCancelFullScreen;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);
      Object.defineProperty(document, 'msFullscreenElement', {
        value: document.documentElement,
        configurable: true,
        writable: true
      });
      const msExitSpy = jasmine.createSpy('msExitFullscreen');
      (document as any).msExitFullscreen = msExitSpy;

      component.toggleFullscreen();

      expect(msExitSpy).toHaveBeenCalled();
      delete (document as any).msFullscreenElement;
      delete (document as any).msExitFullscreen;
    });
  });

  describe('2. Error Handling when requestFullscreen fails or is denied', () => {
    it('should trigger requestFullscreen and demonstrate potential unhandled promise rejection if rejected', () => {
      const rejectionErr = new Error('Permissions check failed');
      const requestSpy = jasmine.createSpy('requestFullscreen').and.callFake(() => Promise.reject(rejectionErr));
      document.documentElement.requestFullscreen = requestSpy;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      // Add a silent unhandledrejection handler during this specific assertion
      const handler = (e: PromiseRejectionEvent) => e.preventDefault();
      window.addEventListener('unhandledrejection', handler);

      expect(() => component.toggleFullscreen()).not.toThrow();
      expect(requestSpy).toHaveBeenCalled();

      window.removeEventListener('unhandledrejection', handler);
    });

    it('should safely handle environments where no fullscreen API is supported (e.g. mobile Safari)', () => {
      delete (document.documentElement as any).requestFullscreen;
      delete (document.documentElement as any).webkitRequestFullscreen;
      delete (document.documentElement as any).mozRequestFullScreen;
      delete (document.documentElement as any).msRequestFullscreen;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      expect(() => component.toggleFullscreen()).not.toThrow();
      expect(component.isFullscreen).toBeFalse();
    });
  });

  describe('3. Behavior on Esc Key / fullscreenchange host listeners', () => {
    it('should update isFullscreen to true when fullscreenchange fires with active fullscreenElement', () => {
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(document.documentElement);

      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();

      expect(component.isFullscreen).toBeTrue();
    });

    it('should update isFullscreen to false when Esc key is pressed (fullscreenchange fires with null fullscreenElement)', () => {
      component.isFullscreen = true;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();

      expect(component.isFullscreen).toBeFalse();
    });

    it('should update isFullscreen when vendor webkitfullscreenchange event fires', () => {
      component.isFullscreen = true;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      document.dispatchEvent(new Event('webkitfullscreenchange'));
      fixture.detectChanges();

      expect(component.isFullscreen).toBeFalse();
    });

    it('should update isFullscreen when vendor mozfullscreenchange event fires', () => {
      component.isFullscreen = true;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      document.dispatchEvent(new Event('mozfullscreenchange'));
      fixture.detectChanges();

      expect(component.isFullscreen).toBeFalse();
    });

    it('should update isFullscreen when vendor MSFullscreenChange event fires', () => {
      component.isFullscreen = true;
      spyOnProperty(document, 'fullscreenElement', 'get').and.returnValue(null);

      document.dispatchEvent(new Event('MSFullscreenChange'));
      fixture.detectChanges();

      expect(component.isFullscreen).toBeFalse();
    });
  });

  describe('4. Accessibility and DOM attribute verification', () => {
    it('should update title attribute dynamically according to isFullscreen state', () => {
      const fullScreenLink = fixture.debugElement.query(By.css('a.full-screen')).nativeElement as HTMLAnchorElement;

      component.isFullscreen = false;
      fixture.detectChanges();
      expect(fullScreenLink.getAttribute('title')).toBe('Toggle Fullscreen');

      component.isFullscreen = true;
      fixture.detectChanges();
      expect(fullScreenLink.getAttribute('title')).toBe('Exit Fullscreen');
    });

    it('should render correct icon classes based on isFullscreen state', () => {
      const iconEl = fixture.debugElement.query(By.css('a.full-screen i')).nativeElement as HTMLElement;

      component.isFullscreen = false;
      fixture.detectChanges();
      expect(iconEl.classList.contains('icon-maximize')).toBeTrue();
      expect(iconEl.classList.contains('icon-minimize')).toBeFalse();

      component.isFullscreen = true;
      fixture.detectChanges();
      expect(iconEl.classList.contains('icon-minimize')).toBeTrue();
      expect(iconEl.classList.contains('icon-maximize')).toBeFalse();
    });

    it('AUDIT: check aria-label attribute presence', () => {
      const fullScreenLink = fixture.debugElement.query(By.css('a.full-screen')).nativeElement as HTMLAnchorElement;
      const ariaLabel = fullScreenLink.getAttribute('aria-label');
      expect(ariaLabel).toBeNull();
    });

    it('AUDIT: check role and aria-pressed attributes presence', () => {
      const fullScreenLink = fixture.debugElement.query(By.css('a.full-screen')).nativeElement as HTMLAnchorElement;
      const role = fullScreenLink.getAttribute('role');
      const ariaPressed = fullScreenLink.getAttribute('aria-pressed');
      expect(role).toBeNull();
      expect(ariaPressed).toBeNull();
    });
  });
});
