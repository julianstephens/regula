import { chakra } from "@chakra-ui/react";
import { Link } from "react-router";

/**
 * React Router Link wrapped with Chakra UI styling support.
 * Accepts all Chakra style props plus `to`, `replace`, `state`, etc.
 */
export const AppLink = chakra(Link);
