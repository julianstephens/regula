import { Box, Button, Code, Heading, Text, VStack } from "@chakra-ui/react";
import { isRouteErrorResponse, useRouteError } from "react-router";

export default function ErrorBoundary() {
  const error = useRouteError();

  let title = "Something went wrong";
  let message = "An unexpected error occurred.";
  let detail: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = error.data?.message ?? error.data ?? message;
  } else if (error instanceof Error) {
    message = error.message;
    detail = error.stack;
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minH="100vh"
      p={8}
    >
      <VStack gap={4} maxW="600px" textAlign="center">
        <Heading size="xl">{title}</Heading>
        <Text color="fg.muted">{message}</Text>
        {detail && (
          <Code
            display="block"
            whiteSpace="pre-wrap"
            p={4}
            borderRadius="md"
            fontSize="xs"
            textAlign="left"
            w="full"
          >
            {detail}
          </Code>
        )}
        <Button onClick={() => window.location.assign("/")}>Go home</Button>
      </VStack>
    </Box>
  );
}
