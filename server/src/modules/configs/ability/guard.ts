import { Injectable } from '@nestjs/common';
import { AbilityGuard } from '@modules/app/guards/ability.guard';
import { FeatureAbilityFactory } from '.';
import { Metadata } from '@entities/metadata.entity';
@Injectable()
export class FeatureAbilityGuard extends AbilityGuard {
  protected getAbilityFactory() {
    return FeatureAbilityFactory;
  }

  protected getSubjectType() {
    return Metadata;
  }
}
