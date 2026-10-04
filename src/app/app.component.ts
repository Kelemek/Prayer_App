import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { AppShellComponent } from "./app-shell.component";
import { ForceUpgradeComponent } from "./components/force-upgrade/force-upgrade.component";
import { ClientVersionGateService } from "./services/client-version-gate.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [AsyncPipe, AppShellComponent, ForceUpgradeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gate.blocked$ | async) {
      <app-force-upgrade />
    } @else {
      <app-shell />
    }
  `,
})
export class AppComponent {
  readonly gate = inject(ClientVersionGateService);
}
