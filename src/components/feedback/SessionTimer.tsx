import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

interface Props {
  startedAt: Date;
  onStop: () => void;
}

export function SessionTimer({ startedAt, onStop }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Box
      p={4}
      borderWidth={2}
      borderColor="orange.emphasized"
      borderRadius="xl"
      bg="orange.subtle"
      display="inline-flex"
      alignItems="center"
      gap={6}
    >
      <Text
        fontSize="2xl"
        fontFamily="mono"
        fontWeight="bold"
        color="orange.fg"
      >
        {h > 0 ? `${pad(h)}:` : ""}
        {pad(m)}:{pad(s)}
      </Text>
      <HStack>
        <Button size="sm" colorPalette="red" variant="solid" onClick={onStop}>
          Stop Session
        </Button>
      </HStack>
    </Box>
  );
}
