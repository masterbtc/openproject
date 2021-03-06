// -- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2015 the OpenProject Foundation (OPF)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See doc/COPYRIGHT.rdoc for more details.
// ++

import {ChangeDetectorRef, Injectable, Injector, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {StateService, Transition} from '@uirouter/core';
import {PathHelperService} from 'core-app/modules/common/path-helper/path-helper.service';
import {componentDestroyed, untilComponentDestroyed} from 'ng2-rx-componentdestroyed';
import {States} from '../states.service';
import {WorkPackageResource} from 'core-app/modules/hal/resources/work-package-resource';
import {RootResource} from 'core-app/modules/hal/resources/root-resource';
import {WorkPackageCacheService} from '../work-packages/work-package-cache.service';
import {HalResourceNotificationService} from "core-app/modules/hal/services/hal-resource-notification.service";
import {WorkPackageCreateService} from './wp-create.service';
import {takeUntil} from 'rxjs/operators';
import {RootDmService} from 'core-app/modules/hal/dm-services/root-dm.service';
import {OpTitleService} from 'core-components/html/op-title.service';
import {I18nService} from "core-app/modules/common/i18n/i18n.service";
import {CurrentUserService} from "core-app/components/user/current-user.service";
import {WorkPackageViewFiltersService} from "core-app/modules/work_packages/routing/wp-view-base/view-services/wp-view-filters.service";
import {WorkPackageChangeset} from "core-components/wp-edit/work-package-changeset";
import {WorkPackageViewFocusService} from "core-app/modules/work_packages/routing/wp-view-base/view-services/wp-view-focus.service";
import {HalResource} from "core-app/modules/hal/resources/hal-resource";
import {EditFormComponent} from "core-app/modules/fields/edit/edit-form/edit-form.component";
import {WorkPackageNotificationService} from "core-app/modules/work_packages/notifications/work-package-notification.service";


@Injectable()
export class WorkPackageCreateController implements OnInit, OnDestroy {
  public successState:string;
  public newWorkPackage:WorkPackageResource;
  public parentWorkPackage:WorkPackageResource;
  public change:WorkPackageChangeset;

  /** Are we in the copying substates ? */
  public copying = false;

  public stateParams = this.$transition.params('to');
  public text = {
    button_settings: this.I18n.t('js.button_settings')
  };

  @ViewChild(EditFormComponent, {static: false}) private editForm:EditFormComponent|undefined;

  constructor(protected readonly $transition:Transition,
              protected readonly $state:StateService,
              protected readonly I18n:I18nService,
              protected readonly titleService:OpTitleService,
              protected readonly injector:Injector,
              protected readonly notificationService:WorkPackageNotificationService,
              protected readonly states:States,
              protected readonly wpCreate:WorkPackageCreateService,
              protected readonly wpViewFocus:WorkPackageViewFocusService,
              protected readonly wpTableFilters:WorkPackageViewFiltersService,
              protected readonly wpCacheService:WorkPackageCacheService,
              protected readonly pathHelper:PathHelperService,
              protected readonly cdRef:ChangeDetectorRef,
              protected readonly RootDm:RootDmService) {

  }

  public ngOnInit() {
    this.closeEditFormWhenNewWorkPackageSaved();

    this
      .createdWorkPackage()
      .then((changeset:WorkPackageChangeset) => {
        this.change = changeset;
        this.newWorkPackage = changeset.projectedResource;
        this.cdRef.detectChanges();

        this.setTitle();

        if (this.stateParams['parent_id']) {
          this.newWorkPackage.parent =
            {href: this.pathHelper.api.v3.work_packages.id(this.stateParams['parent_id']).path};
        }

        // Load the parent simply to display the type name :-/
        if (this.stateParams['parent_id']) {
          this.wpCacheService.loadWorkPackage(this.stateParams['parent_id'])
            .values$()
            .pipe(
              takeUntil(componentDestroyed(this))
            )
            .subscribe(parent => {
              this.parentWorkPackage = parent;
              this.cdRef.detectChanges();
            });
        }
      })
      .catch((error:any) => {
        if (error.errorIdentifier === 'urn:openproject-org:api:v3:errors:MissingPermission') {
          this.RootDm.load().then((root:RootResource) => {
            if (!root.user) {
              // Not logged in
              let url = URI(this.pathHelper.loginPath());
              url.search({back_url: url});
              window.location.href = url.toString();
            }
          });
          this.notificationService.handleRawError(error);
        }
      });
  }

  public ngOnDestroy() {
    // Nothing to do
  }

  public switchToFullscreen() {
    this.$state.go('work-packages.new', this.$state.params);
  }

  public onSaved(params:{ savedResource:WorkPackageResource, isInitial:boolean }) {
    let {savedResource, isInitial} = params;

    // Shouldn't this always be true in create controller?
    // Close all edit fields when saving
    if (isInitial && this.editForm && this.editForm.editMode) {
      this.editForm.stop();
    }

    if (this.successState) {
      this.$state.go(this.successState, {workPackageId: savedResource.id})
        .then(() => {
          this.wpViewFocus.updateFocus(savedResource.id!);
          this.notificationService.showSave(savedResource, isInitial);
        });
    }
  }

  protected setTitle() {
    this.titleService.setFirstPart(this.I18n.t('js.work_packages.create.title'));
  }

  public cancelAndBackToList() {
    this.wpCreate.cancelCreation();
    this.$state.go('work-packages.list', this.$state.params);
  }

  protected createdWorkPackage() {
    const type = this.stateParams.type ? parseInt(this.stateParams.type) : undefined;
    const project = this.stateParams.projectPath;

    return this.wpCreate.createOrContinueWorkPackage(project, type);
  }

  private closeEditFormWhenNewWorkPackageSaved() {
    this.wpCreate
      .onNewWorkPackage()
      .pipe(untilComponentDestroyed(this))
      .subscribe((wp:WorkPackageResource) => {
        this.onSaved({savedResource: wp, isInitial: true});
      });
  }
}
