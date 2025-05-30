import React from 'react';
import Skeleton from 'react-loading-skeleton';
import { datasourceService, pluginsService, globalDatasourceService, libraryAppService } from '@/_services';
import cx from 'classnames';
import { Modal, Button, Tab, Row, Col, ListGroup, ModalBody } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { getSvgIcon } from '@/_helpers/appUtils';
import { TestConnection } from './TestConnection';
import { getWorkspaceId, deepEqual, returnDevelopmentEnv, decodeEntities } from '@/_helpers/utils';
import { getSubpath } from '@/_helpers/routes';
import {
  DataBaseSources,
  ApiSources,
  DataSourceTypes,
  SourceComponent,
  SourceComponents,
  CloudStorageSources,
} from '../../../common/components/DataSourceComponents';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import config from 'config';
import { capitalize, isEmpty } from 'lodash';
import { Card } from '@/_ui/Card';
import { withTranslation, useTranslation } from 'react-i18next';
import { camelizeKeys, decamelizeKeys } from 'humps';
import { ButtonSolid } from '@/_ui/AppButton/AppButton';
import SolidIcon from '@/_ui/Icon/SolidIcons';
import { useAppVersionStore } from '@/_stores/appVersionStore';
import { ConfirmDialog, ToolTip } from '@/_components';
import { shallow } from 'zustand/shallow';
import { useDataSourcesStore } from '@/_stores/dataSourcesStore';
import { withRouter } from '@/_hoc/withRouter';
import useGlobalDatasourceUnsavedChanges from '@/_hooks/useGlobalDatasourceUnsavedChanges';
import { LicenseTooltip } from '@/LicenseTooltip';
import { DATA_SOURCE_TYPE } from '@/_helpers/constants';
import './dataSourceManager.theme.scss';
import { canUpdateDataSource } from '@/_helpers';
import MultiEnvTabs from './MultiEnvTabs';

class DataSourceManagerComponent extends React.Component {
  constructor(props) {
    super(props);

    let selectedDataSource = null;
    let dataSourceSchema = null;
    let selectedDataSourceIcon = null;
    let options = {};
    let dataSourceMeta = {};
    let datasourceName = '';
    if (props.selectedDataSource) {
      selectedDataSource = props.selectedDataSource;
      options = selectedDataSource.options;
      dataSourceMeta = this.getDataSourceMeta(selectedDataSource);
      dataSourceSchema = props.selectedDataSource?.plugin?.manifestFile?.data;
      selectedDataSourceIcon = props.selectDataSource?.plugin?.iconFile.data;
      datasourceName = props.selectedDataSource?.name;
    }

    this.state = {
      showModal: true,
      appId: props.appId,
      selectedDataSource,
      dataSourceSchema,
      selectedDataSourceIcon,
      options,
      dataSourceMeta,
      isSaving: false,
      isCopied: false,
      queryString: null,
      plugins: [],
      filteredDatasources: [],
      activeDatasourceList: '#alldatasources',
      suggestingDatasources: false,
      scope: props?.scope,
      modalProps: props?.modalProps ?? {},
      showBackButton: props?.showBackButton ?? true,
      defaultOptions: {},
      pluginsLoaded: false,
      dataSourceConfirmModalProps: { isOpen: false, dataSource: null },
      addingDataSource: false,
      createdDataSource: null,
      unsavedChangesModal: false,
      datasourceName,
      creatingApp: false,
    };
  }

  componentDidMount() {
    this.setState({
      appId: this.props.appId,
    });

    pluginsService
      .findAll()
      .then(({ data = [] }) => {
        this.setState({ plugins: data, pluginsLoaded: true });
      })
      .catch((error) => {
        this.setState({ pluginsLoaded: true });
        toast.error(error?.message || 'failed to fetch plugins');
      });
  }

  componentDidUpdate(prevProps) {
    this.props.setGlobalDataSourceStatus({ saveAction: this.createDataSource });
    if (prevProps.selectedDataSource !== this.props.selectedDataSource) {
      let dataSourceMeta = this.getDataSourceMeta(this.props.selectedDataSource);
      this.setState({
        selectedDataSource: this.props.selectedDataSource,
        options: this.props.selectedDataSource?.options,
        dataSourceMeta,
        dataSourceSchema: this.props.selectedDataSource?.plugin?.manifestFile?.data,
        selectedDataSourceIcon: this.props.selectedDataSource?.plugin?.iconFile?.data,
        connectionTestError: null,
        datasourceName: this.props.selectedDataSource?.name,
      });
    }
  }

  getDataSourceMeta = (dataSource) => {
    if (!dataSource) return {};

    if (dataSource?.pluginId) {
      let dataSourceMeta = camelizeKeys(dataSource?.plugin?.manifestFile?.data.source);
      dataSourceMeta.options = decamelizeKeys(dataSourceMeta.options);

      return dataSourceMeta;
    }

    return DataSourceTypes.find((source) => source?.kind === dataSource?.kind);
  };

  selectDataSource = (source) => {
    this.hideModal();
    this.setState(
      {
        dataSourceMeta: source.manifestFile?.data?.source ?? source,
        selectedDataSource: source.manifestFile?.data?.source ?? source,
        options: source?.defaults ?? source?.options,
        selectedDataSourceIcon: source.iconFile?.data,
        name: source.manifestFile?.data?.source?.kind ?? source.kind,
        dataSourceSchema: source.manifestFile?.data,
        selectedDataSourcePluginId: source.id,
        datasourceName: source.name,
      },
      () => this.createDataSource()
    );
  };

  onNameChanged = (newName) => {
    this.setState({
      selectedDataSource: {
        ...this.state.selectedDataSource,
        name: newName,
      },
    });
  };

  onExit = () => {
    !this.state.selectedDataSource?.id && this.props.environmentChanged(returnDevelopmentEnv(this.props.environments));
    this.setState({
      dataSourceMeta: {},
      selectedDataSource: null,
      options: {},
      connectionTestError: null,
      queryString: null,
      filteredDatasources: [],
      activeDatasourceList: '#alldatasources',
    });
  };

  setStateAsync = (state) => {
    return new Promise((resolve) => {
      this.setState(state, resolve);
    });
  };

  optionchanged = (option, value) => {
    const stateToUpdate = {
      connectionTestError: null,
      options: {
        ...this.state.options,
        [option]: { value: value },
      },
    };

    return this.setStateAsync(stateToUpdate);
  };

  resetOptions = () => {
    return this.setStateAsync({
      connectionTestError: null,
      options: this.state.defaultOptions,
    });
  };

  hideModal = (ds = null) => {
    this.onExit();
    this.props.hideModal(ds);
  };

  resetDataSourceConfirmModal = () => {
    this.setState({
      dataSourceConfirmModalProps: {
        isOpen: false,
        dataSource: null,
      },
    });
  };

  createDataSource = () => {
    const { appId, options, selectedDataSource, selectedDataSourcePluginId, dataSourceMeta, dataSourceSchema } =
      this.state;
    const OAuthDs = ['slack', 'zendesk', 'googlesheets', 'salesforce'];
    const name = selectedDataSource.name;
    const kind = selectedDataSource?.kind;
    const pluginId = selectedDataSourcePluginId;
    const appVersionId = useAppVersionStore?.getState()?.editingVersion?.id;
    const currentAppEnvironmentId = this.props.currentAppEnvironmentId ?? this.props.currentEnvironment?.id;
    const scope = this.state?.scope || selectedDataSource?.scope;

    const parsedOptions = Object?.keys(options)?.map((key) => {
      const keyMeta = dataSourceMeta.options[key];
      return {
        key: key,
        value: options[key].value,
        encrypted: keyMeta ? keyMeta.encrypted : false,
        ...(!options[key]?.value && { credential_id: options[key]?.credential_id }),
      };
    });
    if (OAuthDs.includes(kind)) {
      const value = localStorage.getItem('OAuthCode');
      parsedOptions.push({ key: 'code', value, encrypted: false });
    }
    if (name.trim() !== '') {
      let service = scope === 'global' ? globalDatasourceService : datasourceService;
      if (selectedDataSource.id) {
        this.setState({ isSaving: true });
        this.props.setGlobalDataSourceStatus({ isSaving: true, isEditing: false });
        service
          .save({
            id: selectedDataSource.id,
            name,
            options: parsedOptions,
            app_id: appId,
            environment_id: currentAppEnvironmentId,
          })
          .then(() => {
            this.props.updateSelectedDatasource && this.props.updateSelectedDatasource(selectedDataSource.name);
            this.setState({ isSaving: false });
            this.hideModal(selectedDataSource);
            toast.success(
              this.props.t('editor.queryManager.dataSourceManager.toast.success.dataSourceSaved', 'Data Source Saved'),
              { position: 'top-center' }
            );
            this.props.dataSourcesChanged(false, selectedDataSource);
            this.props.globalDataSourcesChanged && this.props.globalDataSourcesChanged();
            this.props.setGlobalDataSourceStatus({ isSaving: false, isEditing: false });
            scope === 'local' && this.hideModal();
          })
          .catch(({ error }) => {
            this.setState({ isSaving: false });
            this.hideModal(selectedDataSource);
            error && toast.error(error, { position: 'top-center' });
            this.resetDataSourceConfirmModal();
            this.props.setGlobalDataSourceStatus({ isSaving: false, isEditing: false });
          });
      } else {
        this.setState({ isSaving: true, addingDataSource: true });
        service
          .create({
            plugin_id: pluginId,
            name,
            kind,
            options: parsedOptions,
            app_id: appId,
            app_version_id: appVersionId,
            scope,
            environment_id: currentAppEnvironmentId,
          })
          .then((data) => {
            this.setState({ isSaving: false, addingDataSource: false });
            this.props.updateSelectedDatasource && this.props.updateSelectedDatasource(name);

            this.hideModal(selectedDataSource);
            toast.success(
              this.props.t('editor.queryManager.dataSourceManager.toast.success.dataSourceAdded', 'Data Source Added'),
              { position: 'top-center' }
            );

            this.props.dataSourcesChanged(false, data);
            this.props.globalDataSourcesChanged && this.props.globalDataSourcesChanged();
            this.resetDataSourceConfirmModal();
          })
          .catch(({ error }) => {
            this.setState({ isSaving: false, addingDataSource: false });
            this.hideModal();
            error && toast.error(error, { position: 'top-center' });
            this.resetDataSourceConfirmModal();
          });
      }
    } else {
      toast.error(
        this.props.t(
          'editor.queryManager.dataSourceManager.toast.error.noEmptyDsName',
          'The name of datasource should not be empty'
        ),
        { position: 'top-center' }
      );
    }
  };

  handleSearch = (searchQuery, activeDatasourceList) => {
    this.setState({ queryString: searchQuery });

    const arr = [];
    const filteredDatasources = this.datasourcesGroups().filter((group) => group.key === activeDatasourceList)[0].list;

    filteredDatasources.forEach((datasource) => {
      if (datasource.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        arr.push(datasource);
      }
    });
    this.setState({ filteredDatasources: arr });
  };

  handleBackToAllDatasources = () => {
    this.setState({
      queryString: null,
      filteredDatasources: [],
      activeDatasourceList: '#alldatasources',
    });
  };

  updateSuggestedDatasources = () => {
    this.setState({ suggestingDatasources: true, activeDatasourceList: '#' });
  };

  renderSourceComponent = (kind, isPlugin = false) => {
    const { options, isSaving } = this.state;

    const sourceComponentName = kind?.charAt(0).toUpperCase() + kind?.slice(1);
    const ComponentToRender = isPlugin ? SourceComponent : SourceComponents[sourceComponentName] || SourceComponent;
    return (
      <ComponentToRender
        dataSourceSchema={this.state.dataSourceSchema}
        optionsChanged={(options = {}) => this.setState({ options })}
        optionchanged={this.optionchanged}
        createDataSource={this.createDataSource}
        options={options}
        isSaving={isSaving}
        hideModal={this.hideModal}
        selectedDataSource={this.state.selectedDataSource}
        isEditMode={!isEmpty(this.state.selectedDataSource)}
        currentAppEnvironmentId={this.props.currentEnvironment?.id}
        setDefaultOptions={this.setDefaultOptions}
      />
    );
  };

  setDefaultOptions = (defaults) => {
    this.setState({
      defaultOptions: defaults,
    });
  };

  onConnectionTestFailed = (data) => {
    this.setState({ connectionTestError: data });
  };

  segregateDataSources = (suggestingDatasources, darkMode) => {
    const datasources = this.datasourcesGroups();

    const handleOnSelect = (activekey) => {
      if (suggestingDatasources) {
        this.setState({ suggestingDatasources: false });
      }
      this.setState({ activeDatasourceList: activekey });
    };

    const goBacktoAllDatasources = () => {
      this.setState({ suggestingDatasources: false });
      this.handleBackToAllDatasources();
    };

    const datasourceSuggestionUI = () => {
      return (
        <div className="empty-state-wrapper suggestingDatasourcesWrapper">
          <EmptyStateContainer
            suggestionUI={true}
            queryString={this.state.queryString}
            handleBackToAllDatasources={goBacktoAllDatasources}
            darkMode={this.props.darkMode}
            placeholder={this.props.t(
              'editor.queryManager.dataSourceManager.suggestAnIntegration',
              'Suggest an integration'
            )}
          />
        </div>
      );
    };

    return (
      <Tab.Container
        activeKey={this.state.activeDatasourceList}
        unmountOnExit={true}
        onSelect={(activekey) => handleOnSelect(activekey)}
        id="list-group-tabs-example"
        defaultActiveKey={this.state.activeDatasourceList}
      >
        <Row>
          <Col sm={6} md={4} className={`modal-sidebar ${darkMode ? 'dark' : ''}`}>
            {this.renderSidebarList()}
          </Col>
          <Col style={{ left: '25%' }} className={`modal-body-content ${darkMode ? 'dark' : ''}`}>
            <div className="selected-datasource-list-content">
              <Tab.Content>
                {suggestingDatasources ? (
                  <div className="suggestion-container">
                    <h4 className="justify-content-start">
                      {this.props.t('editor.queryManager.dataSourceManager.suggestDataSource', 'Suggest Datasource')}
                    </h4>
                    {datasourceSuggestionUI()}
                  </div>
                ) : (
                  <>
                    <div className="input-icon modal-searchbar">
                      <SearchBoxContainer
                        dataCy={'datasource-search-input'}
                        onChange={this.handleSearch}
                        onClear={this.handleBackToAllDatasources}
                        queryString={this.state.queryString}
                        activeDatasourceList={this.state.activeDatasourceList}
                        scope={this.state.scope}
                        className="tj-text"
                      />
                    </div>
                    {datasources.map((datasource) => (
                      <Tab.Pane
                        transition={false}
                        active={this.state.activeDatasourceList === datasource.key}
                        bsPrefix={`datasource-modal-${this.state.activeDatasourceList}`}
                        eventKey={datasource.key}
                        key={datasource.key}
                      >
                        {datasource.renderDatasources()}
                      </Tab.Pane>
                    ))}
                  </>
                )}
                {!suggestingDatasources && this.state.queryString && this.state.filteredDatasources.length === 0 && (
                  <div className="empty-state-wrapper row">
                    <EmptyStateContainer
                      queryString={this.state.queryString}
                      handleBackToAllDatasources={this.handleBackToAllDatasources}
                      darkMode={this.props.darkMode}
                      placeholder={this.props.t(
                        'editor.queryManager.dataSourceManager.whatLookingFor',
                        'Tell us what you were looking for?'
                      )}
                    />
                  </div>
                )}
              </Tab.Content>
            </div>
          </Col>
        </Row>
      </Tab.Container>
    );
  };

  datasourcesGroups = () => {
    const allDataSourcesList = {
      databases: DataBaseSources,
      apis: ApiSources,
      cloudStorages: CloudStorageSources,
      plugins: this.state.plugins,
      filteredDatasources: this.state.filteredDatasources,
    };
    const dataSourceList = [
      {
        type: 'All Datasources',
        key: '#alldatasources',
        list: [
          ...allDataSourcesList.databases,
          ...allDataSourcesList.apis,
          ...allDataSourcesList.cloudStorages,
          ...allDataSourcesList.plugins,
        ],
        renderDatasources: () => this.renderCardGroup(allDataSourcesList, 'All Datasources'),
      },
      {
        type: 'Databases',
        key: '#databases',
        list: allDataSourcesList.databases,
        renderDatasources: () => this.renderCardGroup(allDataSourcesList.databases, 'Databases'),
      },
      {
        type: 'APIs',
        key: '#apis',
        list: allDataSourcesList.apis,
        renderDatasources: () => this.renderCardGroup(allDataSourcesList.apis, 'APIs'),
      },
      {
        type: 'Cloud Storage',
        key: '#cloudstorage',
        list: allDataSourcesList.cloudStorages,
        renderDatasources: () => this.renderCardGroup(allDataSourcesList.cloudStorages, 'Cloud Storages'),
      },
      {
        type: 'Plugins',
        key: '#plugins',
        list: allDataSourcesList.plugins,
        renderDatasources: () => this.renderCardGroup(allDataSourcesList.plugins, 'Plugins'),
      },
      {
        type: 'Filtered Datasources',
        key: '#filtereddatasources',
        list: allDataSourcesList.filteredDatasources,
        renderDatasources: () => this.renderCardGroup(this.state.filteredDatasources, this.state.activeDatasourceList),
      },
    ];

    return dataSourceList;
  };

  renderSidebarList = () => {
    const dataSourceList = this.datasourcesGroups().splice(0, 5);

    const updateSuggestionState = () => {
      this.updateSuggestedDatasources();
    };

    return (
      <>
        <ListGroup className="datasource-lists-modal" variant="flush">
          {dataSourceList.map((datasource) => (
            <ListGroup.Item key={datasource.key} eventKey={datasource.key}>
              {`${datasource.type} (${datasource.list.length})`}
            </ListGroup.Item>
          ))}
        </ListGroup>
        <div className="datasource-modal-sidebar-footer">
          <p>
            <span className="footer-text">
              {this.props.t(
                'editor.queryManager.dataSourceManager.noResultFound',
                `Don't see what you were looking for?`
              )}
            </span>
            <br />
            <span className="link-span" onClick={updateSuggestionState}>
              {this.props.t('editor.queryManager.dataSourceManager.suggest', 'Suggest')}
            </span>
          </p>
        </div>
      </>
    );
  };

  createSampleApp = () => {
    let _self = this;
    _self.setState({ creatingApp: true });
    libraryAppService
      .createSampleApp()
      .then((data) => {
        const workspaceId = getWorkspaceId();
        const subpath = getSubpath();
        const path = subpath
          ? `${subpath}/${workspaceId}/apps/${data.app[0].id}`
          : `/${workspaceId}/apps/${data.app[0].id}`;
        window.open(path, '_blank');
        toast.success('App created successfully!');
        _self.setState({ creatingApp: false });
      })
      .catch((errorResponse) => {
        _self.setState({ creatingApp: false });
        const message = errorResponse?.error;
        toast.error(message);
      });
  };

  renderSampleDBModal = () => {
    const { dataSourceMeta, selectedDataSourceIcon, creatingApp } = this.state;
    return (
      <div className="sample-db-modal-body">
        <div className="row sample-db-title" data-cy="sample-db-postgres-title">
          <div className="col-md-1">
            {getSvgIcon(dataSourceMeta?.kind?.toLowerCase(), 35, 35, selectedDataSourceIcon)}
          </div>
          <div className="col-md-1">PostgreSQL</div>
        </div>
        <div className={'sample-db-description'} data-cy="sample-db-description">
          <p className={`p ${this.props.darkMode ? 'dark' : ''}`}>
            This PostgreSQL data source is a shared resource and may show varying data
            <br /> due to real-time updates. It&apos;s reset daily for some consistency, but please note <br />
            it&apos;s designed for user exploration, not production use.
          </p>
        </div>
        <div className="create-btn-cont">
          <ButtonSolid
            className={`create-app-btn`}
            data-cy="create-sample-app-button"
            isLoading={creatingApp}
            // disabled={isSaving || this.props.isVersionReleased || isSaveDisabled}
            variant="primary"
            onClick={this.createSampleApp}
            fill={this.props.darkMode && this.props.isVersionReleased ? '#4c5155' : '#FDFDFE'}
          >
            Create sample application
          </ButtonSolid>
        </div>
        <div className="image-container">
          <img
            src="assets/images/Sample data source.png"
            className="img-sample-db"
            alt="Sample data source"
            data-cy="sample-db-image"
          />
        </div>
      </div>
    );
  };

  renderCardGroup = (source, type) => {
    const openDataSourceConfirmModal = (dataSource) =>
      this.setState({
        dataSourceConfirmModalProps: {
          isOpen: true,
          dataSource,
        },
      });

    if (this.state.queryString && this.state.queryString.length > 0) {
      const filteredDatasources = this.state.filteredDatasources.map((datasource) => {
        const src = datasource?.iconFile?.data
          ? `data:image/svg+xml;base64,${datasource.iconFile?.data}`
          : datasource?.kind?.toLowerCase();

        return {
          ...datasource,
          src,
          title: datasource.name,
        };
      });

      return (
        <>
          <div className="row row-deck mt-4 ">
            <h4 className="mb-2">{type}</h4>
            {filteredDatasources.map((item) => (
              <Card
                key={item.key}
                title={item.title}
                src={item.src}
                handleClick={() => openDataSourceConfirmModal(item)}
                usePluginIcon={isEmpty(item?.iconFile?.data)}
                height="35px"
                width="35px"
              />
            ))}
          </div>
        </>
      );
    }

    if (type === 'All Datasources') {
      const databases = source.databases.map((datasource) => {
        return {
          ...datasource,
          src: datasource?.kind?.toLowerCase(),
          title: datasource.name,
        };
      });
      const apis = source.apis.map((datasource) => {
        return {
          ...datasource,
          src: datasource?.kind?.toLowerCase(),
          title: datasource.name,
        };
      });
      const cloudStorages = source.cloudStorages.map((datasource) => {
        return {
          ...datasource,
          src: datasource?.kind?.toLowerCase(),
          title: datasource.name,
        };
      });

      return (
        <>
          <div>
            <div className="row row-deck mt-4">
              <h4 className="mb-2">{'Databases'}</h4>
              {databases.map((item) => (
                <Card
                  key={item.key}
                  title={item.title}
                  src={item.src}
                  handleClick={() => openDataSourceConfirmModal(item)}
                  usePluginIcon={true}
                  height="35px"
                  width="35px"
                />
              ))}
            </div>
          </div>
          <div>
            <div className="row row-deck mt-4">
              <h4 className="mb-2">{'APIs'}</h4>
              {apis.map((item) => (
                <Card
                  key={item.key}
                  title={item.title}
                  src={item.src}
                  handleClick={() => openDataSourceConfirmModal(item)}
                  usePluginIcon={true}
                  height="35px"
                  width="35px"
                />
              ))}
            </div>
          </div>
          <div>
            <div className="row row-deck mt-4">
              <h4 className="mb-2">{'Cloud Storages'}</h4>
              {cloudStorages.map((item) => (
                <Card
                  key={item.key}
                  title={item.title}
                  src={item.src}
                  handleClick={() => openDataSourceConfirmModal(item)}
                  usePluginIcon={true}
                  height="35px"
                  width="35px"
                />
              ))}
            </div>
          </div>
        </>
      );
    }

    const datasources = source.map((datasource) => {
      const src = datasource?.iconFile?.data
        ? `data:image/svg+xml;base64,${datasource.iconFile?.data}`
        : datasource?.kind?.toLowerCase();

      return {
        ...datasource,
        src,
        title: datasource.name,
      };
    });

    return (
      <>
        <div className="row row-deck mt-4">
          <h4 className="mb-2">{type}</h4>
          {datasources.map((item) => (
            <Card
              key={item.key}
              title={item.title}
              src={item?.src}
              handleClick={() => openDataSourceConfirmModal(item)}
              usePluginIcon={isEmpty(item?.iconFile?.data)}
              height="35px"
              width="35px"
            />
          ))}
        </div>
      </>
    );
  };

  renderEnvironmentsTab = (selectedDataSource) => {
    const multiEnvironmentEnabled = this.props?.featureAccess?.multiEnvironment;
    const isTrial = this.props?.featureAccess?.licenseStatus?.licenseType === 'trial';
    const licenseValid =
      !this.props?.featureAccess?.licenseStatus?.isExpired && this.props?.featureAccess?.licenseStatus?.isLicenseValid;
    return (
      selectedDataSource &&
      this.props.environments?.length > 1 && (
        <nav className="nav nav-tabs mt-3">
          {this.props?.environments.map((env, key) => {
            const Wrapper = ({ children }) =>
              !env?.enabled ? (
                <LicenseTooltip
                  placement="bottom"
                  feature={'multi-environments'}
                  isAvailable={env?.enabled}
                  noTooltipIfValid={true}
                  customMessage={
                    !this.props?.featureAccess?.isLicenseValid || this.props?.featureAccess?.isExpired
                      ? 'Multi-environments are available only in paid plans'
                      : 'Multi-environments are not included in your current plan'
                  }
                >
                  {children}
                </LicenseTooltip>
              ) : (
                <>{children}</>
              );
            return (
              <Wrapper key={key}>
                <a
                  key={env?.id}
                  onClick={() =>
                    this.props.handleActions(() => {
                      if (env?.enabled) {
                        !selectedDataSource?.id && this.resetOptions();
                        this.props.environmentChanged(env, selectedDataSource?.id);
                      }
                    })
                  }
                  disabled={!env?.enabled}
                  className={cx('nav-item nav-link', { active: this.props.currentEnvironment?.name === env.name })}
                  data-cy={`${env.name}-label`}
                >
                  <ToolTip
                    message={'Multi-environments is a paid plan feature'}
                    show={isTrial && licenseValid}
                    placement="bottom"
                  >
                    <div className="d-flex align-items-center">
                      {capitalize(env.name)}
                      {env.priority > 1 && (!multiEnvironmentEnabled || isTrial) && (
                        <SolidIcon className="mx-1" name="enterprisesmall" />
                      )}
                    </div>
                  </ToolTip>
                </a>
              </Wrapper>
            );
          })}
        </nav>
      )
    );
  };

  render() {
    const {
      dataSourceMeta,
      selectedDataSource,
      selectedDataSourceIcon,
      options,
      isSaving,
      connectionTestError,
      isCopied,
      dataSourceSchema,
      pluginsLoaded,
      dataSourceConfirmModalProps,
      addingDataSource,
      datasourceName,
    } = this.state;
    const isPlugin = dataSourceSchema ? true : false;
    const createSelectedDataSource = (dataSource) => {
      this.selectDataSource(dataSource);
    };
    const isSampleDb = selectedDataSource?.type === DATA_SOURCE_TYPE.SAMPLE;
    const sampleDBmodalBodyStyle = isSampleDb ? { paddingBottom: '0px', borderBottom: '1px solid #E6E8EB' } : {};
    const sampleDBmodalFooterStyle = isSampleDb ? { paddingTop: '8px' } : {};
    const isSaveDisabled = selectedDataSource
      ? deepEqual(options, selectedDataSource?.options, ['encrypted']) && selectedDataSource?.name === datasourceName
      : true;
    this.props.setGlobalDataSourceStatus({ isEditing: !isSaveDisabled });
    const docLink = isSampleDb
      ? 'https://docs.tooljet.com/docs/data-sources/sample-data-sources'
      : selectedDataSource?.pluginId && selectedDataSource.pluginId.trim() !== ''
      ? `https://docs.tooljet.com/docs/marketplace/plugins/marketplace-plugin-${selectedDataSource?.kind}/`
      : `https://docs.tooljet.com/docs/data-sources/${selectedDataSource?.kind}`;
    return (
      pluginsLoaded && (
        <div>
          <Modal
            show={this.props.showDataSourceManagerModal}
            size={selectedDataSource ? 'lg' : 'xl'}
            onEscapeKeyDown={this.hideModal}
            className={selectedDataSource ? 'animation-fade' : 'select-datasource-list-modal animation-fade'}
            contentClassName={`${this.props.darkMode ? 'dark-theme' : ''}`}
            animation={false}
            onExit={this.onExit}
            container={this.props.container}
            {...this.props.modalProps}
          >
            <Modal.Header className={'d-block'}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex">
                  {selectedDataSource && this.props.showBackButton && (
                    <div
                      className={`back-btn me-3 mt-3 ${this.props.darkMode ? 'dark' : ''}`}
                      role="button"
                      onClick={() => this.setState({ selectedDataSource: false }, () => this.onExit())}
                    >
                      <img
                        data-cy="button-back-ds-connection-modal"
                        className="m-0"
                        src="assets/images/icons/back.svg"
                        width="30"
                        height="30"
                      />
                    </div>
                  )}
                  <Modal.Title className="mt-3">
                    {selectedDataSource && !isSampleDb ? (
                      <div className="row selected-ds">
                        {getSvgIcon(dataSourceMeta?.kind?.toLowerCase(), 35, 35, selectedDataSourceIcon)}
                        <div className="input-icon" style={{ width: '160px' }}>
                          <input
                            type="text"
                            onChange={(e) => this.onNameChanged(e.target.value)}
                            className="form-control-plaintext form-control-plaintext-sm color-slate12"
                            value={decodeEntities(selectedDataSource.name)}
                            style={{ width: '160px' }}
                            data-cy="data-source-name-input-filed"
                            autoFocus
                            autoComplete="off"
                            disabled={!canUpdateDataSource(selectedDataSource.id)}
                          />
                          {!this.props.isEditing && (
                            <span className="input-icon-addon">
                              <img src="assets/images/icons/edit-source.svg" width="12" height="12" />
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="row">
                        <div className="col-md-2">
                          <SolidIcon name="tooljet" />
                        </div>
                        <div className="col-md-10" data-cy="sample-data-source-title">
                          {' '}
                          Sample data source
                        </div>
                      </div>
                    )}
                    {!selectedDataSource && (
                      <span className="" data-cy="title-add-new-datasource">
                        {this.props.t('editor.queryManager.dataSourceManager.addNewDataSource', 'Add new datasource')}
                      </span>
                    )}
                  </Modal.Title>
                  {!this.props.isEditing && (
                    <span
                      data-cy="button-close-ds-connection-modal"
                      className={`close-btn mx-4 mt-3 ${this.props.darkMode ? 'dark' : ''}`}
                      onClick={() => this.hideModal()}
                    >
                      <SolidIcon name="remove" width="20" fill={'var(--slate12)'} />
                    </span>
                  )}
                </div>
                <div className="tw-pt-[15px]">
                  {this.props.tags &&
                    this.props.tags.map((tag) => {
                      if (tag === 'AI') {
                        return (
                          <div key={tag} className="tag-container">
                            <SolidIcon name="AI-tag" />
                            <span>{tag}</span>
                          </div>
                        );
                      }
                    })}
                </div>
              </div>
              {!isSampleDb && (
                <MultiEnvTabs
                  selectedDataSource={selectedDataSource}
                  environments={this.props.environments}
                  featureAccess={this.props.featureAccess}
                  currentEnvironment={this.props.currentEnvironment}
                  handleActions={this.props.handleActions}
                  environmentChanged={this.props.environmentChanged}
                  resetOptions={this.resetOptions}
                />
              )}
            </Modal.Header>
            {this.props.environmentLoading ? (
              <ModalBody>
                <DataSourceLoader />
              </ModalBody>
            ) : (
              <>
                <Modal.Body style={sampleDBmodalBodyStyle}>
                  {selectedDataSource && !isSampleDb ? (
                    <div className="dataSourceWrapper">
                      {this.renderSourceComponent(selectedDataSource.kind, isPlugin)}
                    </div>
                  ) : (
                    selectedDataSource &&
                    isSampleDb && <div className="dataSourceWrapper">{this.renderSampleDBModal()}</div>
                  )}
                  {!selectedDataSource &&
                    this.segregateDataSources(this.state.suggestingDatasources, this.props.darkMode)}
                </Modal.Body>

                {selectedDataSource && !dataSourceMeta.customTesting && (
                  <Modal.Footer style={sampleDBmodalFooterStyle} className="modal-footer-class">
                    {selectedDataSource && !isSampleDb && (
                      <div className="row w-100">
                        <div className="card-body datasource-footer-info">
                          <div className="row">
                            <div className="col-1">
                              <SolidIcon name="information" fill="#3E63DD" />
                            </div>

                            <div className="col" style={{ maxWidth: '480px' }}>
                              <p data-cy="white-list-ip-text" className="tj-text">
                                {this.props.t(
                                  'editor.queryManager.dataSourceManager.whiteListIP',
                                  'Please white-list our IP address if the data source is not publicly accessible.'
                                )}
                              </p>
                            </div>

                            <div className="col-auto">
                              {isCopied ? (
                                <center className="my-2">
                                  <span className="copied" data-cy="label-ip-copied">
                                    {this.props.t('editor.queryManager.dataSourceManager.copied', 'Copied')}
                                  </span>
                                </center>
                              ) : (
                                <CopyToClipboard
                                  text={config.SERVER_IP}
                                  onCopy={() => {
                                    this.setState({ isCopied: true });
                                  }}
                                >
                                  <ButtonSolid
                                    type="button"
                                    className={`datasource-copy-button`}
                                    data-cy="button-copy-ip"
                                    variant="tertiary"
                                    leftIcon="copy"
                                    iconWidth="12"
                                  >
                                    {this.props.t('editor.queryManager.dataSourceManager.copy', 'Copy')}
                                  </ButtonSolid>
                                </CopyToClipboard>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {connectionTestError && (
                      <div className="row w-100">
                        <div className="alert alert-danger" role="alert">
                          <div className="text-muted" data-cy="connection-alert-text">
                            {connectionTestError.message}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="col">
                      <SolidIcon name="logs" fill="#3E63DD" width="20" style={{ marginRight: '8px' }} />
                      <a
                        className="color-primary tj-docs-link tj-text-sm"
                        href={docLink}
                        target="_blank"
                        rel="noreferrer"
                        data-cy="link-read-documentation"
                      >
                        {this.props.t('globals.readDocumentation', 'Read documentation')}
                      </a>
                    </div>
                    <div
                      className={!isSampleDb ? `col-auto` : 'col-auto test-connection-sample-db'}
                      data-cy="button-test-connection"
                    >
                      <TestConnection
                        kind={selectedDataSource?.kind}
                        pluginId={selectedDataSource?.pluginId ?? this.state.selectedDataSourcePluginId}
                        options={options}
                        onConnectionTestFailed={this.onConnectionTestFailed}
                        darkMode={this.props.darkMode}
                        environmentId={this.props.currentEnvironment?.id}
                        dataSourceId={selectedDataSource?.id}
                        dataSourceType={selectedDataSource?.type}
                      />
                    </div>
                    {!isSampleDb && (
                      <div className="col-auto" data-cy="db-connection-save-button">
                        <ButtonSolid
                          className={`m-2 ${isSaving ? 'btn-loading' : ''}`}
                          isLoading={isSaving}
                          disabled={isSaving || this.props.isVersionReleased || isSaveDisabled}
                          variant="primary"
                          onClick={this.createDataSource}
                          leftIcon="floppydisk"
                          fill={this.props.darkMode && this.props.isVersionReleased ? '#4c5155' : '#FDFDFE'}
                        >
                          {this.props.t('globals.save', 'Save')}
                        </ButtonSolid>
                      </div>
                    )}
                  </Modal.Footer>
                )}

                {!dataSourceMeta?.hideSave && selectedDataSource && dataSourceMeta.customTesting && (
                  <Modal.Footer>
                    <div className="col">
                      <SolidIcon name="logs" fill="#3E63DD" width="20" style={{ marginRight: '8px' }} />
                      <a
                        className="color-primary tj-docs-link tj-text-sm"
                        href={
                          selectedDataSource?.pluginId && selectedDataSource.pluginId.trim() !== ''
                            ? `https://docs.tooljet.com/docs/marketplace/plugins/marketplace-plugin-${selectedDataSource.kind}/`
                            : `https://docs.tooljet.com/docs/data-sources/${selectedDataSource.kind}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {this.props.t('globals.readDocumentation', 'Read documentation')}
                      </a>
                    </div>
                    <div className="col-auto" data-cy="db-connection-save-button">
                      <ButtonSolid
                        leftIcon="floppydisk"
                        fill={'#FDFDFE'}
                        className="m-2"
                        disabled={isSaving || this.props.isVersionReleased || isSaveDisabled}
                        variant="primary"
                        onClick={this.createDataSource}
                      >
                        {isSaving
                          ? this.props.t('editor.queryManager.dataSourceManager.saving' + '...', 'Saving...')
                          : this.props.t('globals.save', 'Save')}
                      </ButtonSolid>
                    </div>
                  </Modal.Footer>
                )}
              </>
            )}
          </Modal>
          <ConfirmDialog
            title={'Add datasource'}
            show={dataSourceConfirmModalProps.isOpen}
            message={`Do you want to add ${dataSourceConfirmModalProps?.dataSource?.name}`}
            onConfirm={() => createSelectedDataSource(dataSourceConfirmModalProps.dataSource)}
            onCancel={this.resetDataSourceConfirmModal}
            confirmButtonText={'Add datasource'}
            confirmButtonType="primary"
            cancelButtonType="tertiary"
            backdropClassName="datasource-selection-confirm-backdrop"
            confirmButtonLoading={addingDataSource}
          />
        </div>
      )
    );
  }
}

const EmptyStateContainer = ({
  suggestionUI = false,
  queryString,
  handleBackToAllDatasources,
  darkMode,
  placeholder,
}) => {
  const { t } = useTranslation();
  const [inputValue, set] = React.useState(() => '');

  const [status, setStatus] = React.useState(false);
  const handleSend = () => {
    if (inputValue) {
      setStatus(true);
      //send value to backend
    }
  };

  React.useEffect(() => {
    setStatus(false);
  }, [queryString]);

  return (
    <div className="empty">
      {queryString && !suggestionUI && (
        <h3>
          {t(
            `editor.queryManager.dataSourceManager.noResultsFor + "${queryString}"`,
            `No results for "${queryString}"`
          )}
        </h3>
      )}
      <center className={`empty-results ${suggestionUI ? 'suggestionUI-results' : ''}`}>
        <img src="assets/images/icons/no-results.svg" width="150" height="150" />
        {status ? (
          <div>
            <p className="text-success mt-2">
              {t('editor.queryManager.dataSourceManager.noteTaken', `Thank you, we've taken a note of that!`)}
            </p>
            <button
              className={`datasource-modal-button ${darkMode && 'dark-button'}`}
              onClick={handleBackToAllDatasources}
            >
              {t('editor.queryManager.dataSourceManager.goToAllDatasources', 'Go to all Datasources')}
            </button>
          </div>
        ) : (
          <div className="row empty-search">
            <div className="col-9 mt-2">
              <div className="input-icon">
                <input
                  type="text"
                  className="form-control mb-2"
                  value={inputValue}
                  placeholder={placeholder}
                  onChange={(e) => set(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSend();
                    }
                  }}
                />
              </div>
            </div>
            <div className="col-auto">
              <Button className="mt-2" disabled={!inputValue.length} variant="primary" onClick={handleSend}>
                {t('editor.queryManager.dataSourceManager.send', 'Send')}
              </Button>
            </div>
          </div>
        )}
      </center>
    </div>
  );
};

const SearchBoxContainer = ({ onChange, onClear, queryString, activeDatasourceList, dataCy, scope }) => {
  const [searchText, setSearchText] = React.useState(queryString ?? '');
  const { t } = useTranslation();
  const handleChange = (e) => {
    setSearchText(e.target.value);
    onChange(e.target.value, activeDatasourceList);
  };

  const clearSearch = () => {
    setSearchText('');
    onClear();
  };

  React.useEffect(() => {
    if (searchText.length > 0) {
      onChange(searchText, activeDatasourceList);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDatasourceList]);

  React.useEffect(() => {
    if (queryString === null) {
      setSearchText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);
  React.useEffect(() => {
    if (searchText === '') {
      onClear();
    }
    let element = document.querySelector('.input-icon .form-control:not(:first-child)');

    if (scope === 'global') {
      element = document.querySelector('.input-icon .form-control');
    }

    if (searchText && element) {
      element.style.paddingLeft = '0.5rem';
    }

    return () => {
      element && (element.style.paddingLeft = '2.5rem');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  return (
    <div className="search-box-wrapper">
      <div style={{ height: '36px' }} className="input-icon d-flex">
        {searchText.length === 0 && (
          <span className="search-icon mt-2 mx-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <circle cx="10" cy="10" r="7" />
              <line x1="21" y1="21" x2="15" y2="15" />
            </svg>
          </span>
        )}
        <input
          type="text"
          value={searchText}
          onChange={handleChange}
          className="form-control"
          placeholder={t('globals.search', 'Search')}
          autoFocus
          data-cy={dataCy}
        />
        {searchText.length > 0 && (
          <span className="clear-icon mt-2" onClick={clearSearch}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="icon icon-tabler icon-tabler-circle-x"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M10 10l4 4m0 -4l-4 4"></path>
            </svg>
          </span>
        )}
      </div>
    </div>
  );
};

const DataSourceLoader = () => {
  const generateLoaders = (max = 7) => {
    const arr = [];
    for (let i = 1; i < max; i++) {
      arr.push(
        <div key={i}>
          <Skeleton className="label-loader" />
          <Skeleton className="input-loader" />
        </div>
      );
    }
    return arr;
  };
  return <div className="data-source-loader-container">{generateLoaders()}</div>;
};

const withStore = (Component) => (props) => {
  const { setGlobalDataSourceStatus } = useDataSourcesStore(
    (state) => ({
      setGlobalDataSourceStatus: state.actions.setGlobalDataSourceStatus,
    }),
    shallow
  );

  const { handleActions } = useGlobalDatasourceUnsavedChanges();

  return <Component {...props} setGlobalDataSourceStatus={setGlobalDataSourceStatus} handleActions={handleActions} />;
};

export const DataSourceManager = withTranslation()(withRouter(withStore(DataSourceManagerComponent)));
