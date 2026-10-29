import { useEffect, useState, type ReactNode } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { isSupabaseConfigured } from '@/config/env';
import {
  clearConsentAuthorization,
  consentLoginHref,
  decisionFailedMessage,
  followAuthorizationRedirect,
  invalidAuthorizationMessage,
  loadAuthorization,
  missingAuthorizationMessage,
  notConfiguredMessage,
  readAuthorizationId,
  rememberConsentAuthorization,
  submitAuthorizationDecision,
  type AuthorizationView,
} from '@/data/oauth-consent';
import { useAuth } from '@/features/auth/AuthProvider';
import { BootScreen } from '@/features/auth/BootScreen';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { Stack } from '@/ui/layout';
import { documentEdges, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

/**
 * OAuth 2.1 consent screen. Route: /oauth/consent?authorization_id=
 * Agree is the only control that calls approveAuthorization.
 */
export default function OAuthConsentScreen() {
  const { ready, session } = useAuth();
  const params = useLocalSearchParams<{ authorization_id?: string | string[] }>();
  const authorizationId = readAuthorizationId(params.authorization_id);
  const configured = isSupabaseConfigured();
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [view, setView] = useState<AuthorizationView | null>(null);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<'approve' | 'deny' | null>(null);
  const current = loadedId === authorizationId;
  const consent = current && view?.kind === 'consent' ? view : null;
  const message = !configured
    ? notConfiguredMessage
    : decisionMessage ?? (current ? loadMessage : null);

  useEffect(() => {
    if (!ready || !session || !authorizationId || !configured) return undefined;
    clearConsentAuthorization();
    let active = true;
    void loadAuthorization(authorizationId).then((result) => {
      if (!active) return;
      if ('message' in result) {
        setLoadedId(authorizationId);
        setView(null);
        setLoadMessage(result.message);
        return;
      }
      if (result.view.kind === 'redirect') {
        setLoadedId(authorizationId);
        setView(null);
        setLoadMessage(followAuthorizationRedirect(result.view.url) ? null : invalidAuthorizationMessage);
        return;
      }
      setLoadedId(authorizationId);
      setView(result.view);
      setLoadMessage(null);
    });
    return () => {
      active = false;
    };
  }, [ready, session, authorizationId, configured]);

  if (!ready) return <BootScreen />;
  if (!authorizationId) return <ConsentFrame message={missingAuthorizationMessage} />;
  if (!session) {
    rememberConsentAuthorization(authorizationId);
    return <Redirect href={consentLoginHref(authorizationId)} />;
  }

  async function decide(decision: 'approve' | 'deny') {
    if (!consent || pending) return;
    setPending(decision);
    setDecisionMessage(null);
    try {
      const result = await submitAuthorizationDecision(authorizationId, decision, consent.redirectUri);
      if ('message' in result) {
        setDecisionMessage(result.message);
        return;
      }
      if (!followAuthorizationRedirect(result.url)) setDecisionMessage(decisionFailedMessage);
    } finally {
      setPending(null);
    }
  }

  return (
    <ConsentFrame message={message ?? (consent ? null : '正在读取授权请求')}>
      {consent ? (
        <Stack gap="md">
          <Card>
            <Text variant="label">应用</Text>
            <Text variant="body">{consent.clientName}</Text>
            <Text variant="label">回调地址</Text>
            <Text variant="body">{consent.redirectUri}</Text>
            <Text variant="label">请求的权限</Text>
            {consent.scopes.length === 0 ? <Text variant="body">未请求权限</Text> : consent.scopes.map((scope) => (
              <Text key={scope} variant="body">{scope}</Text>
            ))}
          </Card>
          <Button
            label="同意"
            fill
            onPress={() => void decide('approve')}
            loading={pending === 'approve'}
            disabled={pending !== null}
          />
          <Button
            label="拒绝"
            variant="secondary"
            fill
            onPress={() => void decide('deny')}
            loading={pending === 'deny'}
            disabled={pending !== null}
          />
        </Stack>
      ) : null}
    </ConsentFrame>
  );
}

function ConsentFrame({ message, children }: { message?: string | null; children?: ReactNode }) {
  return (
    <Screen edges={documentEdges}>
      <Content measure="auth" gap="md">
        <Text variant="title" accessibilityRole="header">授权请求</Text>
        {message ? <Text variant="body">{message}</Text> : null}
        {children}
      </Content>
    </Screen>
  );
}
