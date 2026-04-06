import { captureFailureArtifacts, dumpCurrentScreenElements } from '../../../shared/core/Artifacts';
import { LoginPage } from '../../pages/LoginPage';

describe('Motel6 iOS - Regression', () => {
  const loginPage = new LoginPage();

  afterEach(async function () {
    // @ts-ignore
    const state = this?.currentTest?.state;
    // @ts-ignore
    const title = this?.currentTest?.fullTitle?.() ?? this?.currentTest?.title ?? 'unknown-test';
    if (state === 'failed') {
      await captureFailureArtifacts(title);
    }
  });

  it('TC001 - Extract Login/Landing elements (iOS)', async () => {
    await driver.pause(6000);
    await dumpCurrentScreenElements('ios_initial');

    // Prefer Sign-in flow (no guest).
    await loginPage.openSignInIfPresent();
    await dumpCurrentScreenElements('ios_login_or_initial');
  });
});
