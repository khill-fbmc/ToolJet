import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { LicenseTermsService } from '../interfaces/IService';
import { LICENSE_FIELD, LICENSE_LIMIT } from '../constants';
import { AppsRepository } from '@modules/apps/repository';

@Injectable()
export class WorkflowCountGuard implements CanActivate {
  constructor(protected appsRepository: AppsRepository, protected licenseTermsService: LicenseTermsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!request?.headers['tj-workspace-id']) {
      return false;
    }

    if (!(await this.licenseTermsService.getLicenseTerms(LICENSE_FIELD.VALID))) {
      throw new HttpException('Workflows are available only in paid plans', 451);
    }

    const workflowsLimit = await this.licenseTermsService.getLicenseTerms(LICENSE_FIELD.WORKFLOWS);
    if (!workflowsLimit?.workspace || !workflowsLimit?.instance)
      throw new HttpException('Workflow is not enabled in the license, contact admin', 404);

    // Workspace Level - Total Workflows
    if (
      workflowsLimit.workspace.total !== LICENSE_LIMIT.UNLIMITED &&
      (await this.appsRepository.count({
        where: {
          organizationId: request?.headers['tj-workspace-id'] ?? '',
          type: 'workflow',
        },
      })) >= workflowsLimit.workspace.total
    ) {
      throw new HttpException('Maximum workflow limit reached for the current workspace', 451);
    }

    // Instance Level - Total Workflows
    if (
      workflowsLimit.instance.total !== LICENSE_LIMIT.UNLIMITED &&
      (await this.appsRepository.count({
        where: {
          type: 'workflow',
        },
      })) >= workflowsLimit.instance.total
    ) {
      throw new HttpException('Maximum workflow limit reached', 451);
    }
    return true;
  }
}
