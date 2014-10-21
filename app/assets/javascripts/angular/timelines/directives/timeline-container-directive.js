//-- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2014 the OpenProject Foundation (OPF)
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
//++

module.exports = function(Timeline) {
  getInitialOutlineExpansion = function(timelineOptions) {
    initialOutlineExpansion = timelineOptions.initial_outline_expansion;
    if (initialOutlineExpansion && initialOutlineExpansion >= 0) {
      return initialOutlineExpansion;
    } else {
      return 0;
    }
  };

  return {
    restrict: 'E',
    replace: true,
    controller: ['$scope', function($scope) {
        this.showError = function(errorMessage) {
          $scope.errorMessage = errorMessage;
        };
      }],
    transclude: true,
    template: '<div>' +
              '<div ng-hide="!!errorMessage" ng-transclude id="{{timelineContainerElementId}}"/>' +
              '<div ng-if="!!errorMessage" ng-bind="errorMessage" class="flash error"/>' +
              '</div>',
    link: function(scope) {
      scope.timelineContainerElementId = 'timeline-container-' + (++scope.timelineContainerCount);

      // Hide charts until tables are drawn
      scope.underConstruction = true;

      // Create timeline object
      scope.timeline = Timeline.create(scope.timelineOptions);

      // Set initial expansion index
      scope.timeline.expansionIndex = getInitialOutlineExpansion(scope.timelineOptions);
    }
  };
}
