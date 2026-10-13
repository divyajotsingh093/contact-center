import { redirect } from "next/navigation";
import { currentActor } from "@/ccms/session";

export default async function Home() {
  redirect((await currentActor()) ? "/inbox" : "/login");
}
