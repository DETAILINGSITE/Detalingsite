import { Header } from "@/components/site/header";
import { NotFoundBody } from "@/components/site/not-found-body";

export default function NotFound() {
  return (
    <>
      <Header minimal />
      <main id="main">
        <NotFoundBody />
      </main>
    </>
  );
}
