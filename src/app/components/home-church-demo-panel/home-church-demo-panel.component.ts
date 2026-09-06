import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import type { HomeActiveFilter } from "../../services/home-deep-link-host.adapter";

@Component({
  selector: "app-home-church-demo-panel",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./home-church-demo-panel.component.html",
  host: { class: "block" },
})
export class HomeChurchDemoPanelComponent {
  @Input({ required: true }) activeFilter!: HomeActiveFilter;

  @Output() addChurch = new EventEmitter<void>();

  get heading(): string {
    switch (this.activeFilter) {
      case "current":
        return "Church preview — Current";
      case "answered":
        return "Church preview — Answered";
      case "total":
        return "Church preview — Total";
      case "archived":
        return "Church preview — Archived";
      case "prompts":
        return "Church preview — Prompts";
      case "personal":
      case "memorize":
      case "groups":
        return "Church preview";
      default: {
        const _exhaustive: never = this.activeFilter;
        return _exhaustive;
      }
    }
  }

  get body(): string {
    switch (this.activeFilter) {
      case "current":
        return "This is a preview of current church prayers. Create or join a church to share open requests with your congregation.";
      case "answered":
        return "This is a preview of answered church prayers. Create or join a church to celebrate answers together.";
      case "total":
        return "This is a preview of the full church prayer list. Create or join a church to see every request in one place.";
      case "archived":
        return "This is a preview of archived church prayers. Create or join a church to keep a history of past requests.";
      case "prompts":
        return "This is a preview of church prayer prompts. Create or join a church to guide your congregation with shared prompts.";
      case "personal":
      case "memorize":
      case "groups":
        return "Join or create a church to share prayer requests with your congregation.";
      default: {
        const _exhaustive: never = this.activeFilter;
        return _exhaustive;
      }
    }
  }
}
