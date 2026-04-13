import { AppLink } from "@/components/ui/app-link";
import {
  Box,
  Code,
  Heading,
  NativeSelect,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "react-router";
import remarkGfm from "remark-gfm";

// Load all docs at build-time via Vite glob import
const docModules = import.meta.glob("../../docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Build slug → content map (e.g. "getting-started" → markdown string)
const docs: Record<string, string> = {};
for (const [path, content] of Object.entries(docModules)) {
  const slug = path.replace("../../docs/", "").replace(".md", "");
  docs[slug] = content;
}

// Sidebar navigation structure
const navSections = [
  {
    heading: "Getting Started",
    items: [
      { slug: "README", label: "Overview" },
      { slug: "getting-started", label: "Getting Started" },
      { slug: "core-concepts", label: "Core Concepts" },
    ],
  },
  {
    heading: "Study Planning",
    items: [
      { slug: "programs", label: "Programs" },
      { slug: "modules-and-lessons", label: "Modules & Lessons" },
      { slug: "lesson-detail", label: "Lesson Detail" },
      { slug: "calendar-and-planning", label: "Calendar & Planning" },
    ],
  },
  {
    heading: "Daily Usage",
    items: [
      { slug: "dashboard", label: "Dashboard" },
      { slug: "assessments-and-reviews", label: "Assessments & Reviews" },
      { slug: "resources", label: "Resources" },
    ],
  },
  {
    heading: "Analytics & Tools",
    items: [
      { slug: "reports", label: "Reports" },
      { slug: "settings", label: "Settings" },
      { slug: "yaml-import", label: "YAML Import" },
    ],
  },
  {
    heading: "Tips",
    items: [
      { slug: "tips-and-tricks", label: "Tips & Tricks" },
      { slug: "keyboard-shortcuts", label: "Keyboard Shortcuts" },
    ],
  },
];

const allNavItems = navSections.flatMap((s) => s.items);

/** Convert a relative `.md` href (e.g. "programs.md") to a docs search-param URL */
function mdHrefToPage(href: string): string | null {
  if (!href.endsWith(".md")) return null;
  const slug = href.replace(".md", "").replace(/^.*\//, "");
  return `/docs?page=${slug}`;
}

/** Custom component map for react-markdown */
function makeComponents(
  navigate: (to: string) => void,
): React.ComponentProps<typeof ReactMarkdown>["components"] {
  return {
    h1: ({ children }) => (
      <Heading size="2xl" mb={4} lineHeight="shorter">
        {children}
      </Heading>
    ),
    h2: ({ children }) => (
      <Heading
        size="lg"
        mt={10}
        mb={3}
        pb={2}
        borderBottomWidth={1}
        borderColor="border.subtle"
      >
        {children}
      </Heading>
    ),
    h3: ({ children }) => (
      <Heading size="md" mt={6} mb={2}>
        {children}
      </Heading>
    ),
    h4: ({ children }) => (
      <Heading size="sm" mt={4} mb={1} color="fg.muted" fontWeight="semibold">
        {children}
      </Heading>
    ),
    p: ({ children }) => (
      <Text mb={4} lineHeight="1.75" color="fg">
        {children}
      </Text>
    ),
    strong: ({ children }) => (
      <Box as="strong" fontWeight="semibold" color="fg">
        {children}
      </Box>
    ),
    em: ({ children }) => (
      <Box as="em" fontStyle="italic">
        {children}
      </Box>
    ),
    a: ({ href, children }) => {
      if (!href) return <>{children}</>;
      const internalPath = mdHrefToPage(href);
      if (internalPath) {
        return (
          <AppLink
            to={internalPath}
            color="colorPalette.fg"
            textDecoration="underline"
            textUnderlineOffset="3px"
            _hover={{ opacity: 0.8 }}
            onClick={(e) => {
              e.preventDefault();
              navigate(internalPath);
            }}
          >
            {children}
          </AppLink>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "inherit",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {children}
        </a>
      );
    },
    ul: ({ children }) => (
      <Box
        as="ul"
        mb={4}
        textAlign="left"
        style={{ listStyleType: "disc", paddingInlineStart: "1.25em" }}
      >
        {children}
      </Box>
    ),
    ol: ({ children }) => (
      <Box
        as="ol"
        mb={4}
        textAlign="left"
        style={{ listStyleType: "decimal", paddingInlineStart: "1.25em" }}
      >
        {children}
      </Box>
    ),
    li: ({ children }) => (
      <Box as="li" mb={1.5} lineHeight="1.75">
        {children}
      </Box>
    ),
    code: ({ children, className }) => {
      // Fenced code blocks arrive with a className like "language-yaml"
      const lang = className?.replace("language-", "");
      const isBlock = !!className;
      if (isBlock) {
        return (
          <Box
            borderWidth={1}
            borderColor="border.subtle"
            borderRadius="lg"
            mb={5}
            overflow="hidden"
            fontSize="sm"
          >
            {lang && (
              <Box
                px={4}
                py={1.5}
                bg="bg.muted"
                borderBottomWidth={1}
                borderColor="border.subtle"
                fontSize="xs"
                fontFamily="mono"
                color="fg.subtle"
                letterSpacing="wide"
              >
                {lang}
              </Box>
            )}
            <Box
              as="pre"
              bg="bg.subtle"
              p={4}
              overflowX="auto"
              fontFamily="mono"
              lineHeight="1.65"
              m={0}
            >
              <code>{children}</code>
            </Box>
          </Box>
        );
      }
      return (
        <Code
          fontSize="0.85em"
          px={1.5}
          py={0.5}
          borderRadius="sm"
          colorPalette="gray"
          fontFamily="mono"
        >
          {children}
        </Code>
      );
    },
    pre: ({ children }) => <>{children}</>,
    hr: () => <Separator my={8} />,
    blockquote: ({ children }) => (
      <Box
        borderLeftWidth={4}
        borderColor="colorPalette.emphasized"
        pl={4}
        py={2}
        mb={4}
        bg="colorPalette.subtle"
        borderRadius="0 md md 0"
        color="fg.muted"
        fontStyle="italic"
      >
        {children}
      </Box>
    ),
    table: ({ children }) => (
      <Box
        overflowX="auto"
        mb={6}
        borderWidth={1}
        borderColor="border.subtle"
        borderRadius="lg"
        style={{ overflow: "hidden" }}
      >
        <Box
          as="table"
          w="full"
          fontSize="sm"
          style={{ borderCollapse: "collapse" }}
        >
          {children}
        </Box>
      </Box>
    ),
    thead: ({ children }) => (
      <Box as="thead" bg="bg.muted">
        {children}
      </Box>
    ),
    tbody: ({ children }) => <Box as="tbody">{children}</Box>,
    tr: ({ children }) => (
      <Box
        as="tr"
        borderBottomWidth={1}
        borderColor="border.subtle"
        _last={{ borderBottomWidth: 0 }}
        _hover={{ bg: "bg.subtle" }}
        transition="background 0.1s"
      >
        {children}
      </Box>
    ),
    th: ({ children }) => (
      <Box
        as="th"
        px={4}
        py={2.5}
        textAlign="left"
        fontWeight="semibold"
        fontSize="xs"
        textTransform="uppercase"
        letterSpacing="wide"
        color="fg.muted"
        borderRightWidth={1}
        borderColor="border.subtle"
        _last={{ borderRightWidth: 0 }}
      >
        {children}
      </Box>
    ),
    td: ({ children }) => (
      <Box
        as="td"
        px={4}
        py={2.5}
        borderRightWidth={1}
        borderColor="border.subtle"
        _last={{ borderRightWidth: 0 }}
      >
        {children}
      </Box>
    ),
  };
}

export default function Docs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = searchParams.get("page") ?? "README";
  const content = docs[page] ?? docs["README"] ?? "# Page not found";

  const navigate = (to: string) => {
    const url = new URL(to, window.location.href);
    const nextPage = url.searchParams.get("page");
    if (nextPage) setSearchParams({ page: nextPage });
  };

  const components = makeComponents(navigate);

  return (
    <Box id="docs" display="flex" gap={0} h="full" minH={0}>
      {/* Desktop sidebar */}
      <Box
        w="220px"
        flexShrink={0}
        display={{ base: "none", md: "block" }}
        overflowY="auto"
        pr={4}
        borderRightWidth={1}
        borderColor="border.subtle"
        mr={6}
      >
        <Stack gap={5}>
          {navSections.map((section) => (
            <Stack key={section.heading} gap={1}>
              <Text
                fontSize="xs"
                fontWeight="semibold"
                color="fg.subtle"
                textTransform="uppercase"
                letterSpacing="wide"
                mb={1}
              >
                {section.heading}
              </Text>
              {section.items.map((item) => {
                const isActive = item.slug === page;
                return (
                  <Text
                    key={item.slug}
                    px={2}
                    py={1}
                    borderRadius="md"
                    fontSize="sm"
                    cursor="pointer"
                    fontWeight={isActive ? "semibold" : "normal"}
                    bg={isActive ? "colorPalette.subtle" : "transparent"}
                    color={isActive ? "colorPalette.fg" : "fg.muted"}
                    _hover={{ bg: "bg.muted", color: "fg" }}
                    transition="all 0.15s"
                    onClick={() => setSearchParams({ page: item.slug })}
                  >
                    {item.label}
                  </Text>
                );
              })}
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* Content area */}
      <Box flex={1} overflowY="auto" minW={0}>
        {/* Mobile page selector */}
        <Box display={{ base: "block", md: "none" }} mb={4}>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field
              value={page}
              onChange={(e) => setSearchParams({ page: e.target.value })}
            >
              {allNavItems.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Box>

        {/* Rendered markdown */}
        <Box maxW="740px" pb={12}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
          </ReactMarkdown>
        </Box>
      </Box>
    </Box>
  );
}
