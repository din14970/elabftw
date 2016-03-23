<?php
/**
 * \Elabftw\Elabftw\Create
 *
 * @author Nicolas CARPi <nicolas.carpi@curie.fr>
 * @copyright 2012 Nicolas CARPi
 * @see http://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */
namespace Elabftw\Elabftw;

/**
 * Create an item, experiment or duplicate it.
 */
class Create
{
    /** The PDO object */
    private $pdo;

    /**
     * Constructor
     *
     */
    public function __construct()
    {
        $this->pdo = Db::getConnection();
    }
    /**
     * Copy the tags from one experiment/item to an other.
     *
     * @param int $id The id of the original experiment/item
     * @param int $newId The id of the new experiment/item that will receive the tags
     * @param string $type can be experiment or item
     * @return null
     */
    private function copyTags($id, $newId, $type)
    {
        // TAGS
        if ($type === 'experiment') {
            $sql = "SELECT tag FROM experiments_tags WHERE item_id = :id";
        } else {
            $sql = "SELECT tag FROM items_tags WHERE item_id = :id";
        }
        $req = $this->pdo->prepare($sql);
        $req->bindParam(':id', $id);
        $req->execute();
        $tag_number = $req->rowCount();
        if ($tag_number > 0) {
            while ($tags = $req->fetch()) {
                // Put them in the new one. here $newId is the new exp created
                if ($type === 'experiment') {
                    $sql = "INSERT INTO experiments_tags(tag, item_id, userid) VALUES(:tag, :item_id, :userid)";
                    $reqtag = $this->pdo->prepare($sql);
                    $reqtag->bindParam(':tag', $tags['tag']);
                    $reqtag->bindParam(':item_id', $newId);
                    $reqtag->bindParam(':userid', $_SESSION['userid']);
                } else {
                    $sql = "INSERT INTO items_tags(tag, item_id) VALUES(:tag, :item_id)";
                    $reqtag = $this->pdo->prepare($sql);
                    $reqtag->bindParam(':tag', $tags['tag']);
                    $reqtag->bindParam(':item_id', $newId);
                }
                $reqtag->execute();
            }
        }
    }

    /**
     * Copy the links from one experiment to an other.
     *
     * @param int $id The id of the original experiment
     * @param int $newId The id of the new experiment that will receive the links
     * @return null
     */
    private function copyLinks($id, $newId)
    {
        // LINKS
        $linksql = "SELECT link_id FROM experiments_links WHERE item_id = :id";
        $linkreq = $this->pdo->prepare($linksql);
        $linkreq->bindParam(':id', $id);
        $linkreq->execute();

        while ($links = $linkreq->fetch()) {
            $sql = "INSERT INTO experiments_links (link_id, item_id) VALUES(:link_id, :item_id)";
            $req = $this->pdo->prepare($sql);
            $req->execute(array(
                'link_id' => $links['link_id'],
                'item_id' => $newId
            ));
        }
    }

    /**
     * Duplicate an experiment.
     *
     * @param int $id The id of the experiment to duplicate
     * @return int Will return the ID of the new item
     */
    public function duplicateExperiment($id)
    {
        // SQL to get data from the experiment we duplicate
        $sql = "SELECT title, body, visibility FROM experiments WHERE id = :id AND team = :team";
        $req = $this->pdo->prepare($sql);
        $req->bindParam(':id', $id);
        $req->bindParam(':team', $_SESSION['team_id']);
        $req->execute();
        $experiments = $req->fetch();

        // let's add something at the end of the title to show it's a duplicate
        // capital i looks good enough
        $title = $experiments['title'] . ' I';

        // SQL for duplicateXP
        $sql = "INSERT INTO experiments(team, title, date, body, status, elabid, visibility, userid) VALUES(:team, :title, :date, :body, :status, :elabid, :visibility, :userid)";
        $req = $this->pdo->prepare($sql);
        $req->execute(array(
            'team' => $_SESSION['team_id'],
            'title' => $title,
            'date' => kdate(),
            'body' => $experiments['body'],
            'status' => $this->getStatus(),
            'elabid' => $this->generateElabid(),
            'visibility' => $experiments['visibility'],
            'userid' => $_SESSION['userid']));
        $newId = $this->pdo->lastInsertId();

        self::copyTags($id, $newId, 'experiment');
        self::copyLinks($id, $newId);
        return $newId;
    }

    /**
     * Duplicate an item.
     *
     * @param int $id The id of the item to duplicate
     * @return int $newId The id of the newly created item
     */
    public function duplicateItem($id)
    {
        // SQL to get data from the item we duplicate
        $sql = "SELECT * FROM items WHERE id = :id AND team = :team";
        $req = $this->pdo->prepare($sql);
        $req->bindParam(':id', $id);
        $req->bindParam(':team', $_SESSION['team_id']);
        $req->execute();
        $items = $req->fetch();

        // SQL for duplicateItem
        $sql = "INSERT INTO items(team, title, date, body, userid, type) VALUES(:team, :title, :date, :body, :userid, :type)";
        $req = $this->pdo->prepare($sql);
        $req->execute(array(
            'team' => $items['team'],
            'title' => $items['title'],
            'date' => kdate(),
            'body' => $items['body'],
            'userid' => $_SESSION['userid'],
            'type' => $items['type']
        ));
        $newId = $this->pdo->lastInsertId();

        self::copyTags($id, $newId, 'item');
        return $newId;
    }
}
