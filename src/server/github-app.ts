import { createPrivateKey, createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

export interface GitHubAppOptions {
  appId: string;
  privateKeyPath: string;
  installationId: string;
}

/**
 * Generates short-lived installation tokens for a GitHub App.
 * Uses Node's built-in crypto — no external dependencies.
 */
export class GitHubAppAuth {
  private appId: string;
  private privateKey: string;
  private installationId: string;

  constructor(opts: GitHubAppOptions) {
    this.appId = opts.appId;
    this.privateKey = readFileSync(opts.privateKeyPath, 'utf-8');
    this.installationId = opts.installationId;
  }

  /** Create a JWT signed with the app's private key (valid for 10 minutes). */
  private createJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iat: now - 60, // 60s clock drift allowance
      exp: now + 600, // 10 minute expiry
      iss: this.appId,
    };

    const encHeader = base64url(JSON.stringify(header));
    const encPayload = base64url(JSON.stringify(payload));
    const signingInput = `${encHeader}.${encPayload}`;

    const key = createPrivateKey(this.privateKey);
    const sign = createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = base64urlFromBuffer(sign.sign(key));

    return `${signingInput}.${signature}`;
  }

  /** Generate a short-lived installation access token (expires in 1 hour). */
  async createInstallationToken(): Promise<string> {
    const jwt = this.createJWT();

    const res = await fetch(
      `https://api.github.com/app/installations/${this.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'zooffice-server',
        },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub App token request failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { token: string };
    return data.token;
  }
}

function base64url(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function base64urlFromBuffer(buf: Buffer): string {
  return buf.toString('base64url');
}
