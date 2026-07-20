import { redirect } from "next/navigation";

export default function ConnectPage() {
  redirect("/signin?callbackUrl=/app");
}
