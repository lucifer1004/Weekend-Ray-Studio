import { Anchor, Stack, Text } from '@nvidia/foundations-react-core';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <Stack className="min-h-screen items-center justify-center bg-surface-sunken">
      <Stack gap="4" className="text-center">
        <Text kind="display/xl">404</Text>
        <Text kind="body/regular/lg" className="text-secondary">
          Page not found
        </Text>
        <Anchor href="/">Return to Home</Anchor>
      </Stack>
    </Stack>
  );
};

export default NotFound;
