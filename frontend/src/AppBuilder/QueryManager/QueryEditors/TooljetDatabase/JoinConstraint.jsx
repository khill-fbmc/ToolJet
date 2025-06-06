import React, { useContext } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { TooljetDatabaseContext } from '@/TooljetDatabase/index';
import DropDownSelect from './DropDownSelect';
import { ButtonSolid } from '@/_ui/AppButton/AppButton';
import AddRectangle from '@/_ui/Icon/bulkIcons/AddRectangle';
import Trash from '@/_ui/Icon/solidIcons/Trash';
import Remove from '@/_ui/Icon/solidIcons/Remove';
import Information from '@/_ui/Icon/solidIcons/Information';
import Icon from '@/_ui/Icon/solidIcons/index';
import set from 'lodash/set';
import { isEmpty } from 'lodash';
import { getPrivateRoute } from '@/_helpers/routes';
import { useNavigate } from 'react-router-dom';
import useConfirm from './Confirm';
import { deepClone } from '@/_helpers/utilities/utils.helpers';
import CodeHinter from '@/AppBuilder/CodeEditor';
import { ToolTip } from '@/_components';

const JoinConstraint = ({ darkMode, index, onRemove, onChange, data }) => {
  const { selectedTableId, tables, joinOptions, findTableDetails, tableForeignKeyInfo } =
    useContext(TooljetDatabaseContext);
  const joinType = data?.joinType;
  const baseTableDetails = (selectedTableId && findTableDetails(selectedTableId)) || {};
  const conditionsList = isEmpty(data?.conditions?.conditionsList) ? [{}] : data?.conditions?.conditionsList;

  const operator = data?.conditions?.operator;
  const leftFieldTable = conditionsList?.[0]?.leftField?.table || selectedTableId;
  const rightFieldTable = conditionsList?.[0]?.rightField?.table;

  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();

  const tableSet = new Set();
  (joinOptions || [])
    .filter((_join, i) => i < index)
    .forEach((join) => {
      const { table, conditions } = join;
      tableSet.add(table);
      conditions?.conditionsList?.forEach((condition) => {
        const { leftField, rightField } = condition;
        if (leftField?.table) {
          tableSet.add(leftField?.table);
        }
        if (rightField?.table) {
          tableSet.add(rightField?.table);
        }
      });
    });
  tableSet.add(selectedTableId);

  // In Joins-Query, the table on the LHS should be the ones which we already selected for base table or the tables which we selected on RHS
  const leftTableList = [];
  [...tableSet]
    .filter((table) => table !== rightFieldTable)
    .forEach((t) => {
      const tableDetails = findTableDetails(t);
      const targetTableFKListWithAdjacentTable = checkIfAdjacentTableHasForeignKey(true, t?.table_id);
      if (targetTableFKListWithAdjacentTable.length) {
        leftTableList.unshift({
          label: tableDetails?.table_name ?? '',
          value: t,
          isTargetTable: !!targetTableFKListWithAdjacentTable.length,
        });
      } else {
        leftTableList.push({
          label: tableDetails?.table_name ?? '',
          value: t,
          isTargetTable: !!targetTableFKListWithAdjacentTable.length,
        });
      }
    });

  // Tables to list on Right-Hand-Side of Join operation, Omits already selected table
  const tableList = [];
  tables
    .filter((table) => ![...tableSet, leftFieldTable].includes(table.table_id))
    .forEach((t) => {
      const targetTableFKListWithAdjacentTable = checkIfAdjacentTableHasForeignKey(false, t?.table_id);
      if (targetTableFKListWithAdjacentTable.length) {
        tableList.unshift({
          label: t?.table_name ?? '',
          value: t?.table_id,
          isTargetTable: !!targetTableFKListWithAdjacentTable.length,
        });
      } else {
        tableList.push({
          label: t?.table_name ?? '',
          value: t?.table_id,
          isTargetTable: !!targetTableFKListWithAdjacentTable.length,
        });
      }
    });

  const foreignKeyTableDetails = Object.values(tableForeignKeyInfo)?.flatMap(
    (foreignKeyDetails) => foreignKeyDetails || []
  );

  function isMatchingForeignKeyObjects(foreignKeyTableList, tableList) {
    const foreignKeyObjects = [];
    for (const fkObject of foreignKeyTableList) {
      for (const table of tableList) {
        if (fkObject.referenced_table_id === table.value) {
          foreignKeyObjects.push(fkObject);
        }
      }
    }
    return foreignKeyObjects;
  }

  const foreignKeyDetails = isMatchingForeignKeyObjects(foreignKeyTableDetails, tableList);

  // OnSelecting LHS ro RHS table on Join Operation, Checking if Adjacent table has FK relation and Auto Fill the column values
  function checkIfAdjacentTableHasForeignKey(isChoosingLHStable, tableId) {
    if (isChoosingLHStable && rightFieldTable) {
      const rightFieldTableDetails = findTableDetails(rightFieldTable);
      if (rightFieldTableDetails?.table_name && tableForeignKeyInfo[rightFieldTableDetails.table_name]) {
        return tableForeignKeyInfo[rightFieldTableDetails.table_name].filter(
          (foreignKeyDetail) => foreignKeyDetail.referenced_table_id === tableId
        );
      }
    }

    if (!isChoosingLHStable && leftFieldTable) {
      const leftFieldTableTableDetails = findTableDetails(leftFieldTable);
      if (leftFieldTableTableDetails?.table_name && tableForeignKeyInfo[leftFieldTableTableDetails.table_name]) {
        return tableForeignKeyInfo[leftFieldTableTableDetails.table_name].filter(
          (foreignKeyDetail) => foreignKeyDetail.referenced_table_id === tableId
        );
      }
    }

    return [];
  }

  function autoFillColumnIfForeignKeyExists(tableId, isChoosingLHStable) {
    const adjacentTableForeignKeyDetails = checkIfAdjacentTableHasForeignKey(isChoosingLHStable, tableId);
    if (isChoosingLHStable) {
      if (adjacentTableForeignKeyDetails.length) {
        const newData = deepClone({ ...data });
        const newConditionsList = adjacentTableForeignKeyDetails.map((adjacentTableForeignKey) => {
          const { referenced_column_names = [], column_names = [] } = adjacentTableForeignKey;
          const newCondition = {
            leftField: {
              table: tableId,
              type: 'Column',
              ...(referenced_column_names[0] && { columnName: referenced_column_names[0] }),
            },
            operator: '=',
            rightField: {
              table: rightFieldTable,
              type: 'Column',
              ...(column_names[0] && { columnName: column_names[0] }),
            },
          };

          return newCondition;
        });
        set(newData, 'conditions.conditionsList', newConditionsList);
        onChange(newData);
      } else {
        const newData = deepClone({ ...data });
        const { conditionsList = [{}] } = newData?.conditions || {};
        const newConditionsList = conditionsList.map((condition) => {
          const newCondition = { ...condition };
          set(newCondition, 'leftField.table', tableId);
          set(newCondition, 'operator', '='); //should we removed when we have more options
          return newCondition;
        });
        set(newData, 'conditions.conditionsList', newConditionsList);
        // set(newData, 'table', value?.value);
        onChange(newData);
      }
    } else {
      if (adjacentTableForeignKeyDetails.length) {
        const newData = deepClone({ ...data });
        const newConditionsList = adjacentTableForeignKeyDetails.map((adjacentTableForeignKey) => {
          const { referenced_column_names = [], column_names = [] } = adjacentTableForeignKey;
          const newCondition = {
            leftField: {
              table: leftFieldTable,
              type: 'Column',
              ...(column_names[0] && { columnName: column_names[0] }),
            },
            operator: '=',
            rightField: {
              table: tableId,
              type: 'Column',
              ...(referenced_column_names[0] && { columnName: referenced_column_names[0] }),
            },
          };

          return newCondition;
        });
        set(newData, 'conditions.conditionsList', newConditionsList);
        set(newData, 'table', tableId);
        onChange(newData);
      } else {
        const newData = deepClone({ ...data });
        const { conditionsList = [] } = newData?.conditions || {};
        const newConditionsList = conditionsList.map((condition) => {
          const newCondition = { ...condition };
          set(newCondition, 'rightField.table', tableId);
          set(newCondition, 'operator', '='); //should we removed when we have more options
          return newCondition;
        });
        set(newData, 'conditions.conditionsList', newConditionsList);
        set(newData, 'table', tableId);
        onChange(newData);
      }
    }
  }

  return (
    <Container fluid className="p-0">
      <Row className={`mx-0 ${index === 0 && 'pb-2'}`}>
        <Col sm="2"></Col>
        <Col sm="4" className="text-left">
          Selected Table
        </Col>
        <Col sm="1"></Col>
        <Col sm="4" className="text-left">
          Joining Table
        </Col>
        {index !== 0 && (
          <Col sm="1" className="justify-content-end d-flex pe-0">
            <ButtonSolid
              variant="ghostBlack"
              size="sm"
              className="p-0"
              onClick={async () => {
                const result = await confirm(
                  'Deleting a join will also delete its associated conditions. Are you sure you want to continue ?',
                  'Delete'
                );
                if (result) onRemove();
              }}
            >
              <Remove style={{ height: '16px' }} />
            </ButtonSolid>
          </Col>
        )}
      </Row>
      <Row className="mb-2 mx-0">
        <Col sm="2" className="p-0">
          <div
            style={{
              borderRadius: 0,
              height: '30px',
            }}
            className="tj-small-btn px-2 border border-end-0 rounded-start"
          >
            Join
          </div>
        </Col>
        <Col sm="4" className="p-0">
          {index ? (
            <DropDownSelect
              buttonClasses="border border-end-0"
              showPlaceHolder
              options={leftTableList}
              darkMode={darkMode}
              onChange={async (value) => {
                let result = false;
                if (leftFieldTable.length) {
                  result = await confirm(
                    'Changing the table will also delete its associated conditions. Are you sure you want to continue?',
                    'Change table?'
                  );
                } else {
                  result = true;
                }

                if (result) autoFillColumnIfForeignKeyExists(value?.value, true);
              }}
              onAdd={() => navigate(getPrivateRoute('database'))}
              addBtnLabel={'Add new table'}
              value={leftTableList.find((val) => val?.value === leftFieldTable)}
              shouldShowForeignKeyIcon
            />
          ) : (
            <div
              style={{
                borderRadius: 0,
                height: '30px',
              }}
              className="tj-small-btn px-2 border border-end-0"
            >
              {baseTableDetails?.table_name ?? ''}
            </div>
          )}
        </Col>
        <Col sm="1" className="p-0">
          <DropDownSelect
            buttonClasses="border border-end-0"
            shouldCenterAlignText
            options={staticJoinOperationsList}
            darkMode={darkMode}
            onChange={(value) => onChange({ ...data, joinType: value?.value })}
            value={staticJoinOperationsList.find((val) => val.value === joinType)}
            renderSelected={(selected) =>
              selected ? (
                <div className="w-100">
                  <Icon name={selected?.icon} height={20} width={20} viewBox="" />
                </div>
              ) : (
                ''
              )
            }
          />
        </Col>
        <Col sm="5" className="p-0">
          <DropDownSelect
            buttonClasses="border rounded-end"
            showPlaceHolder
            options={tableList}
            darkMode={darkMode}
            onChange={async (value) => {
              let result = true;
              if (rightFieldTable?.length) {
                result = await confirm(
                  'Changing the table will also delete its associated conditions. Are you sure you want to continue?',
                  'Change table?'
                );
              }

              if (result) autoFillColumnIfForeignKeyExists(value?.value, false);
            }}
            onAdd={() => navigate(getPrivateRoute('database'))}
            addBtnLabel={'Add new table'}
            value={tableList.find((val) => val?.value === rightFieldTable)}
            shouldShowForeignKeyIcon
            referencedForeignKeyDetails={foreignKeyDetails}
          />
        </Col>
      </Row>
      {conditionsList.map((condition, index) => (
        <JoinOn
          condition={condition}
          leftFieldTable={leftFieldTable}
          rightFieldTable={rightFieldTable}
          darkMode={darkMode}
          key={index}
          index={index}
          groupOperator={operator}
          onOperatorChange={(value) => {
            const newData = deepClone(data);
            set(newData, 'conditions.operator', value);
            onChange(newData);
          }}
          onChange={(value) => {
            const newConditionsList = conditionsList.map((con, i) => {
              if (i === index) {
                return value;
              }
              return con;
            });
            const newData = deepClone(data);
            set(newData, 'conditions.conditionsList', newConditionsList);
            onChange(newData);
          }}
          onRemove={() => {
            const newConditionsList = conditionsList.filter((_cond, i) => i !== index);
            const newData = deepClone(data);
            set(newData, 'conditions.conditionsList', newConditionsList);
            onChange(newData);
          }}
        />
      ))}
      <Row className="mb-2 mx-1">
        <Col className="p-0">
          <ButtonSolid
            variant="ghostBlue"
            size="sm"
            onClick={() => {
              const newData = deepClone(data);
              set(newData, 'conditions.conditionsList', [...conditionsList, { operator: '=' }]);
              onChange(newData);
            }}
          >
            <AddRectangle width="15" fill="#3E63DD" opacity="1" secondaryFill="#ffffff" />
            &nbsp;&nbsp; Add more
          </ButtonSolid>
        </Col>
      </Row>
      <ConfirmDialog confirmButtonText="Continue" darkMode={darkMode} />
    </Container>
  );
};

const JoinOn = ({
  condition,
  leftFieldTable,
  rightFieldTable,
  darkMode,
  index,
  onChange,
  groupOperator,
  onOperatorChange,
  onRemove,
}) => {
  const { tableInfo, findTableDetails } = useContext(TooljetDatabaseContext);
  const { operator, leftField, rightField } = condition;
  const leftFieldColumn = leftField?.columnName;
  const rightFieldColumn = rightField?.columnName;

  const leftFieldTableDetails = (leftFieldTable && findTableDetails(leftFieldTable)) || {};
  const rightFieldTableDetails = (rightFieldTable && findTableDetails(rightFieldTable)) || {};

  const leftFieldOptions = leftFieldTableDetails?.table_name
    ? tableInfo[leftFieldTableDetails.table_name]?.map((col) => ({
        label: col.Header,
        value: col.Header,
        icon: col.dataType,
      })) ?? []
    : [];
  const selectedLeftField = leftFieldTableDetails?.table_name
    ? tableInfo[leftFieldTableDetails.table_name]?.find((col) => col.Header === leftFieldColumn) ?? []
    : {};

  const rightFieldOptions = rightFieldTableDetails?.table_name
    ? tableInfo[rightFieldTableDetails.table_name]
        ?.filter((col) => {
          if (selectedLeftField?.dataType) {
            return col.dataType === selectedLeftField.dataType;
          }
          return true;
        })
        .map((col) => ({
          label: col.Header,
          value: col.Header,
          icon: col.dataType,
        })) || []
    : [];

  const selectedRightField = rightFieldTableDetails?.table_name
    ? tableInfo[rightFieldTableDetails.table_name]?.find((col) => col.Header === rightFieldColumn) ?? []
    : {};

  const _operators = [{ label: '=', value: '=' }];

  const groupOperators = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' },
  ];

  return (
    <Row className="mb-2 mx-0">
      <Col
        sm="2"
        className="p-0"
        // data-tooltip-id={`tdb-join-operator-tooltip-${index}`}
        // data-tooltip-content={
        //   index > 1
        //     ? 'The operation is defined by the first condition'
        //     : 'This operation will define all the following conditions'
        // }
      >
        {index == 1 && (
          <DropDownSelect
            buttonClasses="border border-end-0 rounded-start"
            showPlaceHolder
            options={groupOperators}
            darkMode={darkMode}
            value={groupOperators.find((op) => op.value === groupOperator)}
            onChange={(value) => {
              onOperatorChange && onOperatorChange(value?.value);
            }}
          />
        )}
        {index == 0 && (
          <div
            style={{
              height: '30px',
              borderRadius: 0,
            }}
            className="tj-small-btn px-2 border border-end-0 rounded-start"
          >
            On
          </div>
        )}
        {index > 1 && (
          <div
            style={{
              height: '30px',
              borderRadius: 0,
              color: 'var(--slate9)',
            }}
            className="tj-small-btn px-2 border border-end-0 rounded-start"
          >
            {groupOperator}
          </div>
        )}
      </Col>
      <Col sm="4" className="p-0">
        <DropDownSelect
          buttonClasses="border"
          showPlaceHolder
          options={leftFieldOptions}
          darkMode={darkMode}
          emptyError={
            <div className="dd-select-alert-error m-2 d-flex align-items-center">
              <Information />
              No data found
            </div>
          }
          value={leftFieldOptions.find((opt) => opt.value === leftFieldColumn)}
          onChange={(value) => {
            onChange &&
              onChange({
                ...condition,
                leftField: {
                  ...condition.leftField,
                  columnName: value?.value,
                  type: 'Column',
                  table: leftFieldTable,
                },
              });
          }}
        />
        {selectedLeftField?.dataType === 'jsonb' && (
          <div className="tjdb-codehinter-jsonpath">
            <ToolTip
              message={
                condition?.leftField?.jsonpath
                  ? condition.leftField.jsonpath
                  : 'Access nested JSON fields by using -> for JSON object and ->> for text'
              }
              tooltipClassName="tjdb-table-tooltip"
              placement="top"
              trigger={['hover', 'focus']}
              width="160px"
            >
              <span>
                <CodeHinter
                  type="basic"
                  initialValue={condition?.leftField?.jsonpath || ''}
                  lang="javascript"
                  onChange={(value) => {
                    onChange &&
                      onChange({
                        ...condition,
                        leftField: {
                          ...condition.leftField,
                          jsonpath: value,
                        },
                      });
                  }}
                  enablePreview={false}
                  height="30"
                  placeholder="->>key"
                  componentName={condition?.leftField?.columnName ? `{}${condition.leftField.columnName}` : ''}
                />
              </span>
            </ToolTip>
          </div>
        )}
      </Col>
      <Col sm="1" className="p-0 ">
        {/* <DropDownSelect
          options={operators}
          darkMode={darkMode}
          value={operators.find((op) => op.value === operator)}
          onChange={(value) => {
            onChange && onChange({ ...condition, operator: value?.value });
          }}
        /> */}

        {/* Above line is commented and value is hardcoded as below */}

        <div
          style={{ height: '30px', borderRadius: 0 }}
          className="tj-small-btn px-2 text-center border border-start-0 border-end-0"
        >
          {operator}
        </div>
      </Col>
      <Col sm="5" className="p-0 d-flex">
        <div className="flex-grow-1">
          <DropDownSelect
            buttonClasses={`border ${
              index === 0 && !selectedRightField?.dataType === 'jsonb' && 'rounded-end'
            } overflow-hidden `}
            showPlaceHolder
            options={rightFieldOptions}
            emptyError={
              <div className="dd-select-alert-error m-2 d-flex align-items-center">
                <Information />
                {rightFieldTable ? 'No columns of the same data type' : 'No data found'}
              </div>
            }
            darkMode={darkMode}
            value={rightFieldOptions.find((opt) => opt.value === rightFieldColumn)}
            onChange={(value) => {
              onChange &&
                onChange({
                  ...condition,
                  rightField: {
                    ...condition.rightField,
                    columnName: value?.value,
                    type: 'Column',
                    table: rightFieldTable,
                  },
                });
            }}
          />
          {selectedRightField?.dataType === 'jsonb' && (
            <div className="tjdb-codehinter-jsonpath">
              <ToolTip
                message={
                  condition?.rightField?.jsonpath
                    ? condition.rightField.jsonpath
                    : 'Access nested JSON fields by using -> for JSON object and ->> for text'
                }
                tooltipClassName="tjdb-table-tooltip"
                placement="top"
                trigger={['hover', 'focus']}
                width="160px"
              >
                <span>
                  <CodeHinter
                    type="basic"
                    inEditor={true}
                    initialValue={condition?.rightField?.jsonpath || ''}
                    lang="javascript"
                    onChange={(value) => {
                      onChange &&
                        onChange({
                          ...condition,
                          rightField: {
                            ...condition.rightField,
                            jsonpath: value,
                          },
                        });
                    }}
                    enablePreview={false}
                    height="30"
                    placeholder="->>key"
                    componentName={condition?.rightField?.columnName ? `{}${condition.rightField.columnName}` : ''}
                  />
                </span>
              </ToolTip>
            </div>
          )}
        </div>
        {index > 0 && (
          <ButtonSolid
            customStyles={{ height: '30px' }}
            size="sm"
            variant="ghostBlack"
            className="px-1 rounded-0 border border-start-0 rounded-end"
            onClick={onRemove}
          >
            <Trash fill="var(--slate9)" style={{ height: '16px' }} />
          </ButtonSolid>
        )}
      </Col>

      {/* {index > 0 && (
        <Tooltip
          id={`tdb-join-operator-tooltip-${index}`}
          className="tooltip"
          place="left"
          style={{
            borderRadius: '8px',
            width: '180px',
            padding: '8px 12px',
          }}
        />
      )} */}
    </Row>
  );
};

// Base Component for Join Drop Down ----------
const staticJoinOperationsList = [
  { label: 'Inner Join', value: 'INNER', icon: 'innerjoin' },
  { label: 'Left Join', value: 'LEFT', icon: 'leftouterjoin' },
  { label: 'Right Join', value: 'RIGHT', icon: 'rightouterjoin' },
  { label: 'Full Outer Join', value: 'FULL OUTER', icon: 'fullouterjoin' },
];

export default JoinConstraint;
