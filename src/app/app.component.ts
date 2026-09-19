import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { AppShellComponent } from "./app-shell.component";
import { ForceUpgradeComponent } from "./components/force-upgrade/force-upgrade.component";
import { ClientVersionGateService } from "./services/client-version-gate.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [AppShellComponent, ForceUpgradeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gate.isBlocked()) {
      <app-force-upgrade />
    } @else {
      <app-shell />
    }
  `,
})
export class AppComponent {
  readonly gate = inject(ClientVersionGateService);
}
