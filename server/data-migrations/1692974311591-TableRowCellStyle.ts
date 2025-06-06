import { MigrationInterface, QueryRunner } from 'typeorm';
import { AppVersion } from '@entities/app_version.entity';

export class TableRowCellStyle1692974311591 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const entityManager = queryRunner.manager;

    const appVersionRepository = entityManager.getRepository(AppVersion);

    const appVersions = await appVersionRepository.find();

    for (const version of appVersions) {
      const definition = JSON.parse(JSON.stringify(version?.definition));

      if (definition) {
        const pages = definition['pages'];
        if (Object.keys(pages).length > 0) {
          for (const pageId of Object.keys(pages)) {
            const components = pages[pageId]['components'];
            if (Object.keys(components).length > 0) {
              for (const componentId of Object.keys(components)) {
                const component = components[componentId];
                if (component?.component?.component === 'Table') {
                  component.component.definition.styles.tableType = {
                    value: 'table-classic',
                  };
                  component.component.styles.tableType = {
                    ...component.component.styles.tableType,
                    options: [
                      { name: 'Bordered', value: 'table-bordered' },
                      { name: 'Regular', value: 'table-classic' },
                      { name: 'Striped', value: 'table-striped' },
                    ],
                  };
                }
              }
            }
          }
        }

        version.definition = definition;

        await entityManager.update(AppVersion, { id: version.id }, { definition });
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
