import "@nkzw/remdx/style.css";
import "./style.css";
import { render } from "@nkzw/remdx";

void render(document.getElementById("app"), import("./slides.re.mdx"));
