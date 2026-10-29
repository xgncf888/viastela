import { expect, test, type Page, type Route } from '@playwright/test';

type JsonBody = Record<string, unknown>;

function otpPayload(code: string, message: string) {
  return JSON.stringify({ code, error_code: code, msg: message, message });
}

function rememberPost(bucket: JsonBody[], page: Page, url: string, fulfill: (route: Route) => Promise<void>) {
  return page.route(url, async (route) => {
    if (route.request().method() === 'POST') bucket.push(route.request().postDataJSON());
    await fulfill(route);
  });
}

async function sendToCodeStep(page: Page, email = 'yifeng@example.com') {
  await page.goto('/');
  await page.getByRole('textbox', { name: '邮箱' }).fill(email);
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByRole('heading', { name: '验证码已发送，请查收邮箱' })).toBeVisible();
  await expect(page.getByText(`验证码已发到 ${email[0]}***@${email.slice(email.indexOf('@') + 1)}`)).toBeVisible();
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toHaveCount(0);
}

test('provider buttons are stacked outlines and the email step is a single primary action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const google = page.getByRole('button', { name: '使用 Google 登录' });
  const github = page.getByRole('button', { name: '使用 GitHub 登录' });
  const send = page.getByRole('button', { name: '发送验证码' });
  const divider = page.getByText('或', { exact: true });
  await expect(google).toBeVisible();
  await expect(github).toBeVisible();
  await expect(send).toBeVisible();
  await expect(divider).toBeVisible();
  const googleBox = await google.boundingBox();
  const githubBox = await github.boundingBox();
  const sendBox = await send.boundingBox();
  const dividerBox = await divider.boundingBox();
  expect(googleBox && githubBox && sendBox && dividerBox).toBeTruthy();
  expect(githubBox!.y).toBeGreaterThan(googleBox!.y + googleBox!.height - 1);
  expect(githubBox!.width).toBeCloseTo(googleBox!.width, 0);
  expect(sendBox!.width).toBeCloseTo(googleBox!.width, 0);
  expect(dividerBox!.y).toBeGreaterThan(githubBox!.y);
  expect(dividerBox!.y).toBeLessThan(sendBox!.y);

  const googleBg = await google.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(googleBg === 'rgba(0, 0, 0, 0)' || googleBg === 'transparent').toBe(true);
});

test('a wrong code is rejected under the field and a new email is what gets sent and verified', async ({ page }) => {
  const otp: JsonBody[] = [];
  const verify: JsonBody[] = [];
  await rememberPost(otp, page, '**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await rememberPost(verify, page, '**/auth/v1/verify**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: otpPayload('otp_expired', 'Token has expired or is invalid'),
    }),
  );

  await sendToCodeStep(page);
  await expect.poll(() => otp[0]).toMatchObject({ email: 'yifeng@example.com', create_user: true });
  await expect(page.getByText(/\d+ 秒后可重发/)).toBeVisible();
  await expect(page.getByRole('button', { name: '重新发送' })).toHaveCount(0);
  const code = page.getByRole('textbox', { name: '验证码', exact: true });
  await code.fill('123456');
  await expect.poll(() => verify[0]).toMatchObject({ email: 'yifeng@example.com', token: '123456', type: 'email' });
  await expect(page.getByText('验证码不对，再检查一下')).toBeVisible();
  await expect(code).toHaveValue('123456');

  await page.getByRole('button', { name: '换个邮箱' }).click();
  await expect(page.getByLabel('邮箱')).toHaveValue('yifeng@example.com');
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toBeVisible();
  await page.getByLabel('邮箱').fill('ada@example.com');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect.poll(() => otp.at(-1)).toMatchObject({ email: 'ada@example.com', create_user: true });
  await expect(page.getByText('验证码已发到 a***@example.com')).toBeVisible();
  await page.getByRole('textbox', { name: '验证码', exact: true }).fill('123456');
  await expect
    .poll(() => verify.at(-1))
    .toMatchObject({ email: 'ada@example.com', token: '123456', type: 'email' });
});

test('too many verify attempts disable the code field until resend is allowed', async ({ page }) => {
  const otp: JsonBody[] = [];
  const verify: JsonBody[] = [];
  await rememberPost(otp, page, '**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await rememberPost(verify, page, '**/auth/v1/verify**', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: otpPayload('over_request_rate_limit', 'Request rate limit reached'),
    }),
  );

  await sendToCodeStep(page);
  await expect.poll(() => otp[0]).toMatchObject({ email: 'yifeng@example.com', create_user: true });
  const code = page.getByRole('textbox', { name: '验证码', exact: true });
  await code.fill('123456');
  await expect.poll(() => verify[0]).toMatchObject({ email: 'yifeng@example.com', token: '123456', type: 'email' });
  await expect(page.getByText('尝试次数太多，请重新获取验证码')).toBeVisible();
  await expect(code).not.toBeEditable();
  await expect(page.getByRole('button', { name: '重新发送' })).toHaveCount(0);
  await expect(page.getByText(/\d+ 秒后可重发/)).toBeVisible();
});

test('a dropped verify keeps the code and a too-soon send names the countdown', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T00:00:00Z') });
  const otp: JsonBody[] = [];
  const verify: JsonBody[] = [];
  await page.route('**/auth/v1/otp**', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    otp.push(route.request().postDataJSON());
    if (otp.length === 1) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: otpPayload('over_email_send_rate_limit', 'For security purposes, you can only request this after 45 seconds.'),
    });
  });
  await rememberPost(verify, page, '**/auth/v1/verify**', (route) => route.abort('failed'));

  await sendToCodeStep(page);
  await expect.poll(() => otp[0]).toMatchObject({ email: 'yifeng@example.com', create_user: true });
  const code = page.getByRole('textbox', { name: '验证码', exact: true });
  await code.fill('123456');
  await expect
    .poll(() => verify[0])
    .toMatchObject({ email: 'yifeng@example.com', token: '123456', type: 'email' });
  await expect(page.getByText('网络不太稳，稍后再试')).toBeVisible();
  await expect(code).toHaveValue('123456');

  await page.clock.fastForward(15_000);
  await expect(page.getByText('45 秒后可重发')).toBeVisible();
  await page.getByRole('button', { name: '换个邮箱' }).click();
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect.poll(() => otp.at(-1)).toMatchObject({ email: 'yifeng@example.com', create_user: true });
  await expect(page.getByText('发送太频繁，请 45 秒后再试')).toBeVisible();
  await expect(page.getByLabel('邮箱')).toHaveValue('yifeng@example.com');
});

test('the code field keeps digits from typed text and a pasted code submits itself', async ({ page }) => {
  const verify: JsonBody[] = [];
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await rememberPost(verify, page, '**/auth/v1/verify**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: otpPayload('otp_expired', 'Token has expired or is invalid'),
    }),
  );
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  await sendToCodeStep(page);
  const code = page.getByRole('textbox', { name: '验证码', exact: true });
  await code.click();
  await code.pressSequentially('12ab34');
  await expect(code).toHaveValue('1234');

  await page.evaluate(() => navigator.clipboard.writeText('验证码 123456'));
  await code.press('Control+a');
  await code.press('Control+v');
  await expect.poll(() => verify[0]).toMatchObject({ email: 'yifeng@example.com', token: '123456', type: 'email' });
});
